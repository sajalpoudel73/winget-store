import { Activity, Compass, Package, RefreshCw, Settings } from "lucide-react";
import { useStore, type View } from "../store";

const ITEMS: { view: View; label: string; icon: typeof Compass }[] = [
  { view: "discover", label: "Discover", icon: Compass },
  { view: "installed", label: "Installed", icon: Package },
  { view: "updates", label: "Updates", icon: RefreshCw },
  { view: "activity", label: "Activity", icon: Activity },
];

export function Sidebar() {
  const { view, go, upgrades, activeCount } = useStore();
  const updateCount = upgrades.data.upgrades.length;
  const badge = (v: View): { n: number; live?: boolean } | null => {
    if (v === "updates" && updateCount > 0) return { n: updateCount };
    if (v === "activity" && activeCount > 0) return { n: activeCount, live: true };
    return null;
  };
  return (
    <nav className="rail" aria-label="Main">
      <div className="rail-brand">
        <span className="brand-mark" aria-hidden="true" />
        <span>Winget Store</span>
      </div>
      <div className="rail-nav">
        {ITEMS.map(({ view: v, label, icon: Icon }) => {
          const b = badge(v);
          return (
            <button key={v} className={`nav-item ${view === v ? "active" : ""}`} onClick={() => go(v)} aria-current={view === v ? "page" : undefined}>
              <Icon size={18} />
              <span>{label}</span>
              {b ? <span className={`nav-badge ${b.live ? "live" : ""}`}>{b.n}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="rail-foot">
        <button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => go("settings")}>
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
}
