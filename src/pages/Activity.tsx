import { useState } from "react";
import { AlertCircle, CheckCircle2, CircleSlash, Clock, FolderOpen, Loader2, RotateCw, X } from "lucide-react";
import { api } from "../api";
import type { Task } from "../api/types";
import { EmptyState } from "../components/EmptyState";
import { formatDuration } from "../lib/format";
import { useStore } from "../store";

const VERB: Record<Task["kind"], string> = { install: "Install", upgrade: "Update", uninstall: "Remove", download: "Download installer" };

function Log({ taskId }: { taskId: string }) {
  const [lines, setLines] = useState<string[] | null>(null);
  if (lines === null) {
    void api.taskLog(taskId).then(setLines);
    return <pre className="log">Loading…</pre>;
  }
  return <pre className="log">{lines.length ? lines.join("\n") : "No output."}</pre>;
}

function TaskRow({ t }: { t: Task }) {
  const { cancel, retry } = useStore();
  const [showLog, setShowLog] = useState(false);
  const live = t.status === "queued" || t.status === "running";
  const icon =
    t.status === "succeeded" ? <CheckCircle2 size={18} className="ok" /> :
    t.status === "failed" ? <AlertCircle size={18} className="bad" /> :
    t.status === "cancelled" ? <CircleSlash size={18} className="muted" /> :
    t.status === "running" ? <Loader2 size={18} className="spin" /> : <Clock size={18} className="muted" />;
  const took = t.startedAt && t.finishedAt ? formatDuration(t.finishedAt - t.startedAt) : "";
  return (
    <div className="task">
      <div className="task-head">
        {icon}
        <div className="task-main">
          <div className="task-title">
            {VERB[t.kind]} {t.name}
            {t.version ? <span className="pill soft">{t.version}</span> : null}
          </div>
          <div className={`task-line ${t.status === "failed" ? "bad" : ""}`}>{t.note ?? t.lastLine}{took ? ` · ${took}` : ""}</div>
        </div>
        <div className="task-actions">
          {t.status === "succeeded" && t.outputPath ? (
            <button className="btn" onClick={() => void api.revealPath(t.outputPath!)}>
              <FolderOpen size={15} /> Show in folder
            </button>
          ) : null}
          {(t.status === "failed" || t.status === "cancelled") ? (
            <button className="btn" onClick={() => void retry(t)}>
              <RotateCw size={15} /> Retry
            </button>
          ) : null}
          {live ? (
            <button className="btn" onClick={() => void cancel(t.taskId)}>
              <X size={15} /> Cancel
            </button>
          ) : null}
          <button className="btn ghost" onClick={() => setShowLog((s) => !s)}>{showLog ? "Hide output" : "Output"}</button>
        </div>
      </div>
      {t.status === "running" ? (
        <div className={`bar ${t.progress != null && t.phase === "downloading" ? "" : "indeterminate"}`}>
          <span style={{ width: `${Math.round((t.progress ?? 0) * 100)}%` }} />
        </div>
      ) : null}
      {t.status === "running" && t.progressLabel ? <div className="muted small">{t.progressLabel}</div> : null}
      {showLog ? <Log taskId={t.taskId} /> : null}
    </div>
  );
}

export function Activity() {
  const { tasks, clearFinished } = useStore();
  const ordered = tasks.slice().reverse();
  const finished = tasks.some((t) => t.status !== "queued" && t.status !== "running");
  return (
    <div className="page">
      <header className="page-head with-tools">
        <div>
          <h1>Activity</h1>
          <p>Installs run one at a time, in the order you added them.</p>
        </div>
        <div className="head-tools">
          {finished ? <button className="btn" onClick={() => void clearFinished()}>Clear finished</button> : null}
        </div>
      </header>
      {ordered.length === 0 ? (
        <EmptyState title="Nothing in progress">Installs, updates and removals appear here while they run.</EmptyState>
      ) : (
        <div className="tasks">{ordered.map((t) => <TaskRow key={t.taskId} t={t} />)}</div>
      )}
    </div>
  );
}
