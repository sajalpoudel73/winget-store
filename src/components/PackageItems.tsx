import type { ReactNode } from "react";
import type { PackageRef } from "../api/types";
import { isUnmapped, teaser } from "../lib/format";
import { useDetails, useInView } from "../lib/hooks";
import { PackageIcon } from "./PackageIcon";

function prettyName(id: string): string {
  const last = id.split(".").slice(-1)[0] || id;
  return last.replace(/([a-z])([A-Z])/g, "$1 $2");
}

interface CardProps {
  pkg: PackageRef;
  actions: ReactNode;
  onOpen: () => void;
  onMissing?: (id: string) => void;
}

/** Tile used on the Discover page. Details (icon, description) load when the tile scrolls into view. */
export function AppCard({ pkg, actions, onOpen, onMissing }: CardProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const { details, error } = useDetails(pkg.id, pkg.source, seen);
  if (error && onMissing) {
    queueMicrotask(() => onMissing(pkg.id));
    return null;
  }
  const name = details?.name ?? pkg.name ?? prettyName(pkg.id);
  return (
    <div className="card" ref={ref} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <PackageIcon id={pkg.id} name={name} details={details} size={52} />
      <div className="card-body">
        <div className="card-title">{name}</div>
        <div className="card-sub">{details?.publisher || pkg.id}</div>
        <div className={`card-desc ${details ? "" : "skeleton-text"}`}>{details ? teaser(details.description, 96) : ""}</div>
      </div>
      <div className="card-foot">
        <span className="ver">{details?.version ?? ""}</span>
        {actions}
      </div>
    </div>
  );
}

interface RowProps {
  pkg: { id: string; name: string; source?: string };
  /** Right-aligned version column content. */
  meta?: ReactNode;
  hint?: string;
  actions: ReactNode;
  onOpen: () => void;
  /** Skip `winget show` (for apps winget cannot map to a package). */
  noDetails?: boolean;
  badge?: ReactNode;
}

export function PackageRow({ pkg, meta, hint, actions, onOpen, noDetails, badge }: RowProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const enabled = seen && !noDetails && !isUnmapped(pkg.id, pkg.source ?? "winget");
  const { details } = useDetails(pkg.id, pkg.source, enabled);
  const sub = details ? teaser(details.description, 110) : pkg.id;
  return (
    <div className="row" ref={ref} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <PackageIcon id={pkg.id} name={pkg.name} details={details} size={40} />
      <div className="row-main">
        <div className="row-title">
          <span className="row-name">{pkg.name}</span>
          {badge}
          {hint ? <span className="pill soft">{hint}</span> : null}
        </div>
        <div className="row-sub" title={pkg.id}>
          {sub}
        </div>
      </div>
      <div className="row-meta">{meta}</div>
      <div className="row-actions">{actions}</div>
    </div>
  );
}
