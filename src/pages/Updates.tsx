import { ArrowUpCircle, RefreshCw } from "lucide-react";
import { api } from "../api";
import { ActionButton } from "../components/ActionButton";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { PackageRow } from "../components/PackageItems";
import { useStore } from "../store";

export function Updates() {
  const { upgrades, refreshUpgrades, enqueue, activeTaskFor, openDetail, toast } = useStore();
  const { upgrades: list, explicit } = upgrades.data;
  const idle = list.filter((p) => !activeTaskFor(p.id));

  const check = async () => {
    try {
      await api.refreshSources();
    } catch (e) {
      toast(String(e), "bad");
    }
    await refreshUpgrades();
  };

  return (
    <div className="page">
      <header className="page-head with-tools">
        <div>
          <h1>Updates</h1>
          <p>{!upgrades.loaded ? "Checking for updates…" : list.length === 0 ? "Everything winget manages is up to date." : `${list.length} update${list.length === 1 ? "" : "s"} available`}</p>
        </div>
        <div className="head-tools">
          <button className="btn" onClick={() => void check()} disabled={upgrades.loading}>
            <RefreshCw size={15} className={upgrades.loading ? "spin" : ""} /> Check now
          </button>
          {idle.length > 0 ? (
            <button
              className="btn primary"
              onClick={() => void enqueue(idle.map((p) => ({ kind: "upgrade" as const, id: p.id, name: p.name, source: p.source || undefined })))}
            >
              <ArrowUpCircle size={15} /> Update all ({idle.length})
            </button>
          ) : null}
        </div>
      </header>

      {upgrades.error && list.length === 0 ? (
        <EmptyState title="Couldn’t check for updates" action={<button className="btn" onClick={() => void refreshUpgrades()}>Try again</button>}>
          {upgrades.error}
        </EmptyState>
      ) : !upgrades.loaded ? (
        <SkeletonRows count={4} />
      ) : list.length === 0 && explicit.length === 0 ? (
        <EmptyState title="You’re up to date">Use Check now to refresh the package sources and look again.</EmptyState>
      ) : (
        <>
          <div className="list">
            {list.map((p) => {
              const pkg = { id: p.id, name: p.name, source: p.source || undefined };
              return (
                <PackageRow
                  key={p.id}
                  pkg={pkg}
                  meta={
                    <span className="ver">
                      {p.version} <span className="ver-new">→ {p.available}</span>
                    </span>
                  }
                  onOpen={() => openDetail(pkg)}
                  actions={<ActionButton pkg={pkg} />}
                />
              );
            })}
          </div>
          {explicit.length > 0 ? (
            <section className="shelf">
              <h2>Needs a manual update</h2>
              <p className="muted">These are pinned, or winget cannot tell which version is installed, so “Update all” skips them. Updating one forces winget to try.</p>
              <div className="list">
                {explicit.map((p) => {
                  const pkg = { id: p.id, name: p.name, source: p.source || undefined };
                  const busy = activeTaskFor(p.id);
                  return (
                    <PackageRow
                      key={p.id}
                      pkg={pkg}
                      meta={
                        <span className="ver">
                          {p.version} <span className="ver-new">→ {p.available}</span>
                        </span>
                      }
                      onOpen={() => openDetail(pkg)}
                      actions={
                        busy ? (
                          <ActionButton pkg={pkg} />
                        ) : (
                          <button
                            className="btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              void enqueue([{ kind: "upgrade", id: p.id, name: p.name, source: p.source || undefined, force: true }]);
                            }}
                          >
                            Update anyway
                          </button>
                        )
                      }
                    />
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
