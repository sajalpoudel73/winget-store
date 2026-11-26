export interface WingetStatus {
  available: boolean;
  version?: string | null;
  error?: string | null;
}

export interface PackageSummary {
  name: string;
  id: string;
  version: string;
  source: string;
  matchHint: string;
}

export interface InstalledPackage {
  name: string;
  id: string;
  version: string;
  available: string;
  source: string;
}

export interface UpgradeList {
  upgrades: InstalledPackage[];
  explicit: InstalledPackage[];
}

export interface InstallerInfo {
  installerType: string;
  architecture: string;
  locale: string;
  scope: string;
  downloadUrl: string;
  sha256: string;
  releaseDate: string;
  storeProductId: string;
  offlineDistribution: string;
}

export interface PackageDetails {
  id: string;
  name: string;
  version: string;
  publisher: string;
  publisherUrl: string;
  publisherSupportUrl: string;
  author: string;
  moniker: string;
  description: string;
  homepage: string;
  license: string;
  licenseUrl: string;
  privacyUrl: string;
  copyright: string;
  copyrightUrl: string;
  releaseNotes: string;
  releaseNotesUrl: string;
  tags: string[];
  documentation: { label: string; url: string }[];
  installers: InstallerInfo[];
}

export type TaskKind = "install" | "upgrade" | "uninstall" | "download";
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface TaskRequest {
  kind: TaskKind;
  id: string;
  name: string;
  source?: string;
  version?: string;
  scope?: string;
  force?: boolean;
  purge?: boolean;
}

export interface Task {
  taskId: string;
  kind: TaskKind;
  id: string;
  name: string;
  source?: string | null;
  version?: string | null;
  status: TaskStatus;
  progress?: number | null;
  progressLabel?: string | null;
  phase?: string | null;
  lastLine: string;
  exitCode?: number | null;
  error?: string | null;
  note?: string | null;
  outputPath?: string | null;
  createdAt: number;
  startedAt?: number | null;
  finishedAt?: number | null;
}

export interface PackageRef {
  id: string;
  name: string;
  source?: string;
  version?: string;
}
