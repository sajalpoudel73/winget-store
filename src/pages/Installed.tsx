import { useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import type { PackageRef } from "../api/types";
import { ActionButton, LaunchButton } from "../components/ActionButton";
import { ConfirmUninstall } from "../components/ConfirmUninstall";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { PackageRow } from "../components/PackageItems";
import { isUnmapped } from "../lib/format";
import { useStore } from "../store";

export function Installed({ filter }: { filter: string }) {
  const { installed, refreshInstalled, openDetail, activeTaskFor } = useStore();
  const [onlyManaged, setOnlyManaged] = useState(true);
  const [confirm, setConfirm] = useState<PackageRef | null>(null);

  const q = filter.trim().toLowerCase();
  const all = installed.data;
  const managed = useMemo(() => all.filter((p) => !isUnmapped(p.id, p.source)), [all]);
  const shown = useMemo(() => {
    const base = onlyManaged ? managed : all;
    const f = q ? base.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) : base;
    return f.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [all, managed, onlyManaged, q]);

  return (
    <div className="page">
      <header className="page-head with-tools">
        <div>
          <h1>Installed</h1>
          <p>{installed.loaded ? `${managed.length} apps managed by winget${all.length > managed.length ? `, ${all.length - managed.length} others` : ""}` : "Reading your apps…"}</p>
        </div>
        <div className="head-tools">
          <label className="check">
            <input type="checkbox" checked={onlyManaged} onChange={(e) => setOnlyManaged(e.target.checked)} />
            <span>Only apps winget can update</span>
          </label>
          <button className="btn" onClick={() => void refreshInstalled()} disabled={installed.loading}>
            <RefreshCw size={15} className={installed.loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </header>
      {installed.error && !installed.data.length ? (
        <EmptyState title="Couldn’t read installed apps" action={<button className="btn" onClick={() => void refreshInstalled()}>Try again</button>}>
          {installed.error}
        </EmptyState>
      ) : !installed.loaded ? (
        <SkeletonRows />
      ) : shown.length === 0 ? (
        <EmptyState title={q ? "No installed app matches" : "Nothing here yet"}>{q ? "Check the spelling, or clear the search." : "Apps you install with Winget Store will show up here."}</EmptyState>
      ) : (
        <div className="list">
          {shown.map((p) => {
            const unmapped = isUnmapped(p.id, p.source);
            const pkg = { id: p.id, name: p.name, source: p.source || undefined };
            const busy = !!activeTaskFor(p.id);
            return (
              <PackageRow
                key={`${p.id}|${p.version}`}
                pkg={pkg}
                noDetails={unmapped}
                badge={unmapped ? <span className="pill">Not in winget</span> : undefined}
                meta={
                  <span className="ver">
                    {p.version}
                    {p.available ? <span className="ver-new"> → {p.available}</span> : null}
                  </span>
                }
                onOpen={() => (unmapped ? undefined : openDetail(pkg))}
                actions={
                  <>
                    {!unmapped ? <ActionButton pkg={pkg} /> : <LaunchButton pkg={pkg} />}
                    {!busy ? (
                      <button
                        className="icon-btn danger-hover"
                        title={`Uninstall ${p.name}`}
                        aria-label={`Uninstall ${p.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirm({ id: p.id, name: p.name, source: p.source || undefined });
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </>
                }
              />
            );
          })}
        </div>
      )}
      {confirm ? <ConfirmUninstall pkg={confirm} onClose={() => setConfirm(null)} /> : null}
    </div>
  );
}
