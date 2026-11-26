import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children ? <p className="empty-text">{children}</p> : null}
      {action}
    </div>
  );
}

export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="row skeleton-row" key={i}>
          <span className="icon skeleton" style={{ ["--s" as string]: "40px" }} />
          <div className="row-main">
            <div className="skeleton line" style={{ width: `${30 + ((i * 17) % 30)}%` }} />
            <div className="skeleton line short" style={{ width: `${45 + ((i * 11) % 30)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
