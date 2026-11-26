import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import type { InstalledPackage, PackageRef, Task, TaskRequest, UpgradeList, WingetStatus } from "./api/types";

export type View = "discover" | "installed" | "updates" | "activity" | "settings";

export interface Settings {
  theme: "system" | "light" | "dark";
  scope: "default" | "user" | "machine";
  onlineIcons: boolean;
}

const DEFAULT_SETTINGS: Settings = { theme: "system", scope: "default", onlineIcons: true };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("wgs.settings");
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "good" | "bad";
}

interface Loadable<T> {
  data: T;
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

interface StoreValue {
  status: WingetStatus | null;
  recheckStatus: () => void;
  installed: Loadable<InstalledPackage[]>;
  upgrades: Loadable<UpgradeList>;
  refreshInstalled: () => Promise<void>;
  refreshUpgrades: () => Promise<void>;
  refreshAll: () => Promise<void>;
  installedById: (id: string) => InstalledPackage | undefined;
  upgradeFor: (id: string) => InstalledPackage | undefined;
  tasks: Task[];
  activeTaskFor: (id: string) => Task | undefined;
  activeCount: number;
  enqueue: (requests: TaskRequest[]) => Promise<void>;
  cancel: (taskId: string) => Promise<void>;
  retry: (task: Task) => Promise<void>;
  clearFinished: () => Promise<void>;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
  view: View;
  go: (view: View) => void;
  detail: PackageRef | null;
  openDetail: (ref: PackageRef) => void;
  closeDetail: () => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}

const emptyUpgrades: UpgradeList = { upgrades: [], explicit: [] };
const lc = (s: string) => s.toLowerCase();

interface NavigationEntry {
  view: View;
  detail: PackageRef | null;
}

interface AppHistoryState {
  wingetStore: NavigationEntry;
}

function isView(value: unknown): value is View {
  return value === "discover" || value === "installed" || value === "updates" || value === "activity" || value === "settings";
}

function readNavigation(state: unknown): NavigationEntry | null {
  if (!state || typeof state !== "object" || !("wingetStore" in state)) return null;
  const entry = (state as AppHistoryState).wingetStore;
  if (!entry || !isView(entry.view)) return null;
  const detail = entry.detail;
  if (detail !== null && (!detail || typeof detail !== "object" || typeof detail.id !== "string" || typeof detail.name !== "string")) {
    return null;
  }
  return { view: entry.view, detail };
}

function writeNavigation(entry: NavigationEntry, replace = false) {
  const state: AppHistoryState = { wingetStore: entry };
  if (replace) window.history.replaceState(state, "");
  else window.history.pushState(state, "");
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WingetStatus | null>(null);
  const [installed, setInstalled] = useState<Loadable<InstalledPackage[]>>({ data: [], loading: false, error: null, loaded: false });
  const [upgrades, setUpgrades] = useState<Loadable<UpgradeList>>({ data: emptyUpgrades, loading: false, error: null, loaded: false });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [view, setView] = useState<View>("discover");
  const [detail, setDetail] = useState<PackageRef | null>(null);
  const toastId = useRef(0);

  useEffect(() => {
    const current = readNavigation(window.history.state);
    if (current) {
      setView(current.view);
      setDetail(current.detail);
    } else {
      writeNavigation({ view, detail }, true);
    }

    const onPopState = (event: PopStateEvent) => {
      const entry = readNavigation(event.state);
      if (entry) {
        setView(entry.view);
        setDetail(entry.detail);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const refreshInstalled = useCallback(async () => {
    setInstalled((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.listInstalled();
      setInstalled({ data, loading: false, error: null, loaded: true });
    } catch (e) {
      setInstalled((s) => ({ ...s, loading: false, error: String(e), loaded: true }));
    }
  }, []);

  const refreshUpgrades = useCallback(async () => {
    setUpgrades((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.listUpgrades();
      setUpgrades({ data, loading: false, error: null, loaded: true });
    } catch (e) {
      setUpgrades((s) => ({ ...s, loading: false, error: String(e), loaded: true }));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshInstalled(), refreshUpgrades()]);
  }, [refreshInstalled, refreshUpgrades]);

  const checkStatus = useCallback(async () => {
    const s = await api.wingetStatus().catch((e) => ({ available: false, error: String(e) }) as WingetStatus);
    setStatus(s);
    if (s.available) {
      void refreshAll();
    }
  }, [refreshAll]);

  // Boot: check winget, load installed apps, restore any running tasks.
  useEffect(() => {
    void checkStatus();
    api.listTasks().then(setTasks).catch(() => undefined);
  }, [checkStatus]);

  // Live task updates from the backend. When something finishes, re-read what is installed.
  const refreshTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    api
      .onTaskUpdate((t) => {
        setTasks((prev) => {
          const i = prev.findIndex((x) => x.taskId === t.taskId);
          if (i === -1) return [...prev, t];
          const copy = prev.slice();
          copy[i] = t;
          return copy;
        });
        if (t.status === "succeeded" && t.kind !== "download") {
          window.clearTimeout(refreshTimer.current);
          refreshTimer.current = window.setTimeout(() => void refreshAll(), 900);
        }
      })
      .then((u) => {
        if (cancelled) u();
        else off = u;
      });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [refreshAll]);

  // Toasts when tasks end.
  const seenFinal = useRef(new Set<string>());
  useEffect(() => {
    for (const t of tasks) {
      if (seenFinal.current.has(t.taskId)) continue;
      const verb = { install: "Installed", upgrade: "Updated", uninstall: "Removed", download: "Downloaded installer for" }[t.kind];
      if (t.status === "succeeded") {
        seenFinal.current.add(t.taskId);
        toast(`${verb} ${t.name}`, "good");
      } else if (t.status === "failed") {
        seenFinal.current.add(t.taskId);
        toast(`${t.name}: ${t.error ?? "failed"}`, "bad");
      } else if (t.status === "cancelled") {
        seenFinal.current.add(t.taskId);
      }
    }
  }, [tasks, toast]);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem("wgs.settings", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const enqueue = useCallback(
    async (requests: TaskRequest[]) => {
      const withScope = requests.map((r) => ({
        ...r,
        scope: r.scope ?? (r.kind === "install" && settings.scope !== "default" ? settings.scope : undefined),
      }));
      try {
        await api.enqueue(withScope);
        toast(withScope.length === 1 ? `Added ${withScope[0].name} to the queue` : `Added ${withScope.length} apps to the queue`);
      } catch (e) {
        toast(String(e), "bad");
      }
    },
    [settings.scope, toast],
  );

  const cancel = useCallback(async (taskId: string) => api.cancelTask(taskId), []);
  const retry = useCallback(
    async (t: Task) => {
      await enqueue([{ kind: t.kind, id: t.id, name: t.name, source: t.source ?? undefined, version: t.version ?? undefined }]);
    },
    [enqueue],
  );
  const clearFinished = useCallback(async () => {
    await api.clearFinished();
    setTasks((prev) => prev.filter((t) => t.status === "queued" || t.status === "running"));
  }, []);

  const installedMap = useMemo(() => new Map(installed.data.map((p) => [lc(p.id), p])), [installed.data]);
  const upgradeMap = useMemo(() => new Map(upgrades.data.upgrades.map((p) => [lc(p.id), p])), [upgrades.data]);
  const activeMap = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) if (t.status === "queued" || t.status === "running") if (!m.has(lc(t.id)) || t.status === "running") m.set(lc(t.id), t);
    return m;
  }, [tasks]);

  const go = useCallback((v: View) => {
    if (v === view && detail === null) return;
    writeNavigation({ view: v, detail: null });
    setView(v);
    setDetail(null);
  }, [view, detail]);

  const openDetail = useCallback((ref: PackageRef) => {
    if (detail?.id === ref.id && detail.source === ref.source) return;
    writeNavigation({ view, detail: ref });
    setDetail(ref);
  }, [view, detail]);

  const closeDetail = useCallback(() => {
    if (detail) window.history.back();
  }, [detail]);

  const value: StoreValue = {
    status,
    recheckStatus: () => void checkStatus(),
    installed,
    upgrades,
    refreshInstalled,
    refreshUpgrades,
    refreshAll,
    installedById: (id) => installedMap.get(lc(id)),
    upgradeFor: (id) => upgradeMap.get(lc(id)),
    tasks,
    activeTaskFor: (id) => activeMap.get(lc(id)),
    activeCount: activeMap.size,
    enqueue,
    cancel,
    retry,
    clearFinished,
    settings,
    setSettings,
    toasts,
    toast,
    view,
    go,
    detail,
    openDetail,
    closeDetail,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
