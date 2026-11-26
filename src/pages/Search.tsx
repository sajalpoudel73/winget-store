import { useEffect, useState } from "react";
import { api } from "../api";
import type { PackageSummary } from "../api/types";
import { ActionButton } from "../components/ActionButton";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { PackageRow } from "../components/PackageItems";
import { useStore } from "../store";

export function Search({ query }: { query: string }) {
  const { openDetail } = useStore();
  const [results, setResults] = useState<PackageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setResults(null);
    setError(null);
    api
      .searchPackages(query)
      .then((r) => alive && setResults(r))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [query, tick]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Results for “{query}”</h1>
        {results ? <p>{results.length === 0 ? "" : `${results.length} package${results.length === 1 ? "" : "s"}${results.length >= 60 ? " (showing the first 60)" : ""}`}</p> : null}
      </header>
      {error ? (
        <EmptyState title="Search didn’t work" action={<button className="btn" onClick={() => setTick((t) => t + 1)}>Try again</button>}>
          {error}
        </EmptyState>
      ) : results === null ? (
        <SkeletonRows />
      ) : results.length === 0 ? (
        <EmptyState title="No packages found">Try a shorter name, or part of the publisher’s name.</EmptyState>
      ) : (
        <div className="list">
          {results.map((r) => {
            const pkg = { id: r.id, name: r.name, source: r.source || undefined, version: r.version };
            return (
              <PackageRow
                key={`${r.source}:${r.id}`}
                pkg={pkg}
                hint={r.matchHint}
                meta={<span className="ver">{r.version}</span>}
                onOpen={() => openDetail(pkg)}
                actions={<ActionButton pkg={pkg} />}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
