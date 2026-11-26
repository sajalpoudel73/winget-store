import type {
  InstalledPackage,
  PackageDetails,
  PackageSummary,
  Task,
  TaskRequest,
  UpgradeList,
  WingetStatus,
} from "./types";
import { tauriApi } from "./tauri";
import { mockApi } from "./mock";

export interface Api {
  /** True when running with sample data in a plain browser instead of inside the desktop app. */
  readonly isMock: boolean;
  wingetStatus(): Promise<WingetStatus>;
  searchPackages(query: string, source?: string): Promise<PackageSummary[]>;
  listInstalled(): Promise<InstalledPackage[]>;
  listUpgrades(): Promise<UpgradeList>;
  packageDetails(id: string, source?: string, version?: string): Promise<PackageDetails>;
  packageVersions(id: string, source?: string): Promise<string[]>;
  refreshSources(): Promise<string>;
  enqueue(requests: TaskRequest[]): Promise<Task[]>;
  cancelTask(taskId: string): Promise<void>;
  listTasks(): Promise<Task[]>;
  taskLog(taskId: string): Promise<string[]>;
  clearFinished(): Promise<void>;
  onTaskUpdate(cb: (task: Task) => void): Promise<() => void>;
  openUrl(url: string): Promise<void>;
  revealPath(path: string): Promise<void>;
  launchApp(id: string, name: string): Promise<void>;
}

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const api: Api = inTauri ? tauriApi : mockApi;
