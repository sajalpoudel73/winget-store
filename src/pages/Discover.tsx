import { useCallback, useMemo, useState } from "react";
import { CATEGORIES } from "../lib/curated";
import { ActionButton } from "../components/ActionButton";
import { AppCard } from "../components/PackageItems";
import { useStore } from "../store";

export function Discover() {
  const { openDetail } = useStore();
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const onMissing = useCallback((id: string) => setMissing((s) => (s.has(id) ? s : new Set(s).add(id))), []);
  const cats = useMemo(() => CATEGORIES, []);
  return (
    <div className="page">
      <header className="page-head">
        <h1>Discover</h1>
        <p>Popular picks from the winget catalog. Search above to find anything else.</p>
      </header>
      {cats.map((c) => {
        const ids = c.ids.filter((id) => !missing.has(id));
        if (ids.length === 0) return null;
        return (
          <section key={c.key} className="shelf">
            <h2>{c.label}</h2>
            <div className="grid">
              {ids.map((id) => {
                const pkg = { id, name: id.split(".").slice(-1)[0], source: "winget" };
                return <AppCard key={id} pkg={pkg} onMissing={onMissing} onOpen={() => openDetail(pkg)} actions={<ActionButton pkg={pkg} />} />;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
