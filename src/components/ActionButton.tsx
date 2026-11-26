import type { CSSProperties, MouseEvent } from "react";
import { useState } from "react";
import { ArrowUpCircle, Download, Play, X } from "lucide-react";
import { api } from "../api";
import type { PackageRef, Task } from "../api/types";
import { useStore } from "../store";

function busyLabel(t: Task): string {
  if (t.status === "queued") return "Queued";
  if (t.status === "running" && t.progress != null) {
    return `Downloading ${Math.round(t.progress * 100)}%`;
  }
  switch (t.phase) {
    case "downloading":
      return "Downloading";
    case "verifying":
      return "Verifying";
    case "installing":
      return t.kind === "upgrade" ? "Updating" : "Installing";
    case "uninstalling":
      return "Removing";
    default:
      return t.kind === "uninstall" ? "Removing" : t.kind === "upgrade" ? "Updating" : "Working";
  }
}

const stop = (e: MouseEvent) => e.stopPropagation();

/** The button that morphs into a live progress bar while its package is being worked on. */
export function BusyButton({ task }: { task: Task }) {
  const { cancel } = useStore();
  const determinate = task.status === "running" && task.progress != null;
  const style = { "--p": `${Math.round((task.progress ?? 0) * 100)}%` } as CSSProperties;
  return (
    <span className="act-busy" onClick={stop}>
      <span className={`act ${task.status === "queued" ? "waiting" : determinate ? "determinate" : "indeterminate"}`} style={style} role="status" aria-live="polite">
        <span className="act-label">{busyLabel(task)}</span>
      </span>
      <button className="icon-btn" title="Cancel" aria-label={`Cancel ${task.name}`} onClick={() => void cancel(task.taskId)}>
        <X size={14} />
      </button>
    </span>
  );
}

export function LaunchButton({ pkg, size = "md" }: { pkg: PackageRef; size?: "md" | "lg" }) {
  const { toast } = useStore();
  const [launching, setLaunching] = useState(false);
  return (
    <button
      className={`btn ${size === "lg" ? "lg" : ""}`}
      disabled={launching}
      onClick={(e) => {
        stop(e);
        setLaunching(true);
        void api.launchApp(pkg.id, pkg.name).catch((error) => toast(String(error), "bad")).finally(() => setLaunching(false));
      }}
    >
      <Play size={size === "lg" ? 16 : 15} /> {launching ? "Launching…" : "Launch"}
    </button>
  );
}

interface Props {
  pkg: PackageRef;
  size?: "md" | "lg";
}

/** Install / Update / Launch, or live progress when a task is running for this package. */
export function ActionButton({ pkg, size = "md" }: Props) {
  const { installedById, upgradeFor, activeTaskFor, enqueue } = useStore();
  const inst = installedById(pkg.id);
  const task = activeTaskFor(pkg.id);
  if (task) {
    return (
      <>
        {inst ? <LaunchButton pkg={pkg} size={size} /> : null}
        <BusyButton task={task} />
      </>
    );
  }

  const up = upgradeFor(pkg.id);
  const cls = `btn primary ${size === "lg" ? "lg" : ""}`;

  if (inst && up) {
    return (
      <>
        <LaunchButton pkg={pkg} size={size} />
        <button
          className={cls}
          onClick={(e) => {
            stop(e);
            void enqueue([{ kind: "upgrade", id: pkg.id, name: pkg.name, source: pkg.source || inst.source || undefined }]);
          }}
        >
          <ArrowUpCircle size={15} /> Update
        </button>
      </>
    );
  }
  if (inst) {
    return <LaunchButton pkg={pkg} size={size} />;
  }
  return (
    <button
      className={cls}
      onClick={(e) => {
        stop(e);
        void enqueue([{ kind: "install", id: pkg.id, name: pkg.name, source: pkg.source, version: pkg.version }]);
      }}
    >
      <Download size={15} /> Install
    </button>
  );
}
