import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { Api } from "./index";
import type { Task } from "./types";

export const tauriApi: Api = {
  isMock: false,
  wingetStatus: () => invoke("winget_status"),
  searchPackages: (query, source) => invoke("search_packages", { query, source: source ?? null }),
  listInstalled: () => invoke("list_installed"),
  listUpgrades: () => invoke("list_upgrades"),
  packageDetails: (id, source, version) =>
    invoke("package_details", { id, source: source ?? null, version: version ?? null }),
  packageVersions: (id, source) => invoke("package_versions", { id, source: source ?? null }),
  refreshSources: () => invoke("refresh_sources"),
  enqueue: (requests) => invoke("enqueue_tasks", { requests }),
  cancelTask: (taskId) => invoke("cancel_task", { taskId }),
  listTasks: () => invoke("list_tasks"),
  taskLog: (taskId) => invoke("task_log", { taskId }),
  clearFinished: () => invoke("clear_finished_tasks"),
  onTaskUpdate: async (cb) => {
    const unlisten = await listen<Task>("task-update", (e) => cb(e.payload));
    return unlisten;
  },
  openUrl: (url) => openUrl(url),
  revealPath: (path) => revealItemInDir(path),
  launchApp: (id, name) => invoke("launch_installed_app", { id, name }),
};
