// Sample-data implementation of the API so the UI can run in a plain browser (`npm run dev`).
// Inside the desktop app the real implementation in tauri.ts is used instead.
import type { Api } from "./index";
import type {
  InstalledPackage,
  PackageDetails,
  PackageSummary,
  Task,
  TaskRequest,
  UpgradeList,
} from "./types";

interface Sample {
  id: string;
  name: string;
  publisher: string;
  version: string;
  homepage: string;
  description: string;
  tags: string[];
  license: string;
  type: string;
  source?: string;
  size?: string;
}

const S: Sample[] = [
  { id: "Mozilla.Firefox", name: "Mozilla Firefox", publisher: "Mozilla", version: "133.0", homepage: "https://www.mozilla.org/firefox/", description: "Fast, private browsing from a non-profit. Built-in tracking protection, tab groups and a huge extension catalog.", tags: ["browser", "web", "privacy"], license: "MPL-2.0", type: "nullsoft" },
  { id: "Google.Chrome", name: "Google Chrome", publisher: "Google LLC", version: "131.0.6778.86", homepage: "https://www.google.com/chrome/", description: "A fast, secure browser from Google with sync across your devices.", tags: ["browser", "web"], license: "Freeware", type: "msi" },
  { id: "Brave.Brave", name: "Brave", publisher: "Brave Software", version: "1.73.101", homepage: "https://brave.com", description: "A Chromium-based browser that blocks ads and trackers by default.", tags: ["browser", "privacy", "adblock"], license: "MPL-2.0", type: "exe" },
  { id: "Microsoft.VisualStudioCode", name: "Visual Studio Code", publisher: "Microsoft Corporation", version: "1.95.3", homepage: "https://code.visualstudio.com/", description: "Code editing, redefined. Free, built on open source, runs everywhere, with debugging, Git and thousands of extensions.", tags: ["editor", "ide", "typescript", "developer-tools"], license: "Microsoft Software License", type: "inno" },
  { id: "Git.Git", name: "Git", publisher: "The Git Development Community", version: "2.47.1", homepage: "https://github.com/git-for-windows/git", description: "Distributed version control system. Git for Windows adds a Bash shell and credential manager.", tags: ["git", "vcs", "developer-tools"], license: "GPL-2.0", type: "inno" },
  { id: "Python.Python.3.13", name: "Python 3.13", publisher: "Python Software Foundation", version: "3.13.1", homepage: "https://www.python.org/", description: "The Python programming language, with the standard library and the py launcher.", tags: ["python", "language", "developer-tools"], license: "PSF-2.0", type: "burn" },
  { id: "OpenJS.NodeJS.LTS", name: "Node.js (LTS)", publisher: "OpenJS Foundation", version: "22.12.0", homepage: "https://nodejs.org/", description: "JavaScript runtime built on Chrome's V8 engine, long-term support release.", tags: ["javascript", "runtime", "developer-tools"], license: "MIT", type: "wix" },
  { id: "Docker.DockerDesktop", name: "Docker Desktop", publisher: "Docker Inc.", version: "4.36.0", homepage: "https://www.docker.com/products/docker-desktop/", description: "Build, share and run containers on Windows with a one-click setup of Docker Engine and Kubernetes.", tags: ["containers", "docker", "developer-tools"], license: "Proprietary", type: "exe" },
  { id: "Notepad++.Notepad++", name: "Notepad++", publisher: "Notepad++ Team", version: "8.7.3", homepage: "https://notepad-plus-plus.org/", description: "A free source code editor that supports several languages, with a light, fast interface.", tags: ["editor", "text"], license: "GPL-3.0", type: "nullsoft" },
  { id: "Microsoft.PowerToys", name: "PowerToys", publisher: "Microsoft Corporation", version: "0.86.0", homepage: "https://github.com/microsoft/PowerToys", description: "A set of utilities to tune and streamline your Windows experience: FancyZones, PowerToys Run, Color Picker and more.", tags: ["utilities", "productivity", "windows"], license: "MIT", type: "exe" },
  { id: "VideoLAN.VLC", name: "VLC media player", publisher: "VideoLAN", version: "3.0.21", homepage: "https://www.videolan.org/vlc/", description: "Plays almost every audio and video format, DVDs and streams, with no extra codecs needed.", tags: ["media", "video", "audio", "player"], license: "GPL-2.0", type: "nullsoft" },
  { id: "OBSProject.OBSStudio", name: "OBS Studio", publisher: "OBS Project", version: "30.2.3", homepage: "https://obsproject.com", description: "Free and open source software for video recording and live streaming.", tags: ["streaming", "recording", "video"], license: "GPL-2.0", type: "inno" },
  { id: "Spotify.Spotify", name: "Spotify", publisher: "Spotify AB", version: "1.2.52", homepage: "https://www.spotify.com", description: "Music and podcasts for every moment, with the full desktop experience.", tags: ["music", "streaming"], license: "Proprietary", type: "exe", source: "winget" },
  { id: "Audacity.Audacity", name: "Audacity", publisher: "Audacity Team", version: "3.7.0", homepage: "https://www.audacityteam.org/", description: "Free, open source, cross-platform audio software for multi-track recording and editing.", tags: ["audio", "editor", "recording"], license: "GPL-3.0", type: "inno" },
  { id: "7zip.7zip", name: "7-Zip", publisher: "Igor Pavlov", version: "24.09", homepage: "https://7-zip.org/", description: "A file archiver with a high compression ratio. Opens zip, rar, tar, iso and more.", tags: ["archive", "compression", "utilities"], license: "LGPL-2.1", type: "exe" },
  { id: "voidtools.Everything", name: "Everything", publisher: "voidtools", version: "1.4.1.1026", homepage: "https://www.voidtools.com", description: "Locates files and folders by name instantly, as you type.", tags: ["search", "files", "utilities"], license: "Freeware", type: "exe" },
  { id: "ShareX.ShareX", name: "ShareX", publisher: "ShareX Team", version: "17.0.0", homepage: "https://getsharex.com", description: "Capture screenshots and screen recordings, then annotate and share with one hotkey.", tags: ["screenshot", "recording", "utilities"], license: "GPL-3.0", type: "inno" },
  { id: "Discord.Discord", name: "Discord", publisher: "Discord Inc.", version: "1.0.9175", homepage: "https://discord.com", description: "Voice, video and text chat for communities and friends.", tags: ["chat", "voice", "community"], license: "Proprietary", type: "exe" },
  { id: "Zoom.Zoom", name: "Zoom Workplace", publisher: "Zoom Communications", version: "6.2.11", homepage: "https://zoom.us", description: "Video meetings, team chat and webinars in one app.", tags: ["meetings", "video", "chat"], license: "Proprietary", type: "msi" },
  { id: "Telegram.TelegramDesktop", name: "Telegram Desktop", publisher: "Telegram FZ-LLC", version: "5.8.3", homepage: "https://desktop.telegram.org/", description: "Fast, secure messaging with cloud sync across all your devices.", tags: ["chat", "messaging"], license: "GPL-3.0", type: "inno" },
  { id: "Valve.Steam", name: "Steam", publisher: "Valve Corporation", version: "2.10.91.91", homepage: "https://store.steampowered.com", description: "Buy, play and discuss games on the world's largest PC game platform.", tags: ["games", "launcher"], license: "Proprietary", type: "nullsoft" },
  { id: "Obsidian.Obsidian", name: "Obsidian", publisher: "Obsidian", version: "1.7.7", homepage: "https://obsidian.md", description: "A private, flexible notes app that works on local Markdown files and links your ideas.", tags: ["notes", "markdown", "productivity"], license: "Freeware", type: "nullsoft" },
  { id: "Bitwarden.Bitwarden", name: "Bitwarden", publisher: "Bitwarden Inc.", version: "2024.11.1", homepage: "https://bitwarden.com", description: "Open source password manager for individuals and teams.", tags: ["passwords", "security"], license: "GPL-3.0", type: "nullsoft" },
  { id: "TheDocumentFoundation.LibreOffice", name: "LibreOffice", publisher: "The Document Foundation", version: "24.8.3", homepage: "https://www.libreoffice.org/", description: "A powerful, free office suite: documents, spreadsheets, presentations, drawings and databases.", tags: ["office", "documents", "productivity"], license: "MPL-2.0", type: "msi" },
  { id: "qBittorrent.qBittorrent", name: "qBittorrent", publisher: "The qBittorrent project", version: "5.0.2", homepage: "https://www.qbittorrent.org/", description: "A free, open source BitTorrent client with no ads.", tags: ["torrent", "download"], license: "GPL-2.0", type: "nullsoft" },
  { id: "BlenderFoundation.Blender", name: "Blender", publisher: "Blender Foundation", version: "4.3.0", homepage: "https://www.blender.org", description: "Free and open source 3D creation suite: modelling, animation, rendering and video editing.", tags: ["3d", "animation", "graphics"], license: "GPL-3.0", type: "msi" },
  { id: "Inkscape.Inkscape", name: "Inkscape", publisher: "Inkscape Project", version: "1.4", homepage: "https://inkscape.org", description: "Professional vector graphics editor for illustrations, logos and diagrams.", tags: ["vector", "graphics", "design"], license: "GPL-3.0", type: "msi" },
  { id: "Rustlang.Rustup", name: "Rustup", publisher: "Rust Project", version: "1.27.1", homepage: "https://rustup.rs", description: "The Rust toolchain installer. Manage compilers and targets side by side.", tags: ["rust", "developer-tools"], license: "MIT", type: "portable" },
  { id: "Microsoft.WindowsTerminal", name: "Windows Terminal", publisher: "Microsoft Corporation", version: "1.21.3231.0", homepage: "https://github.com/microsoft/terminal", description: "Modern terminal with tabs, panes and GPU-accelerated text for PowerShell, cmd and WSL.", tags: ["terminal", "shell", "developer-tools"], license: "MIT", type: "msix" },
  { id: "WinDirStat.WinDirStat", name: "WinDirStat", publisher: "WinDirStat Team", version: "2.2.2", homepage: "https://windirstat.net", description: "See which files and folders take up your disk space, as a treemap.", tags: ["disk", "utilities"], license: "GPL-2.0", type: "wix" },
];

const BY_ID = new Map(S.map((s) => [s.id.toLowerCase(), s]));

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toDetails(s: Sample, version?: string): PackageDetails {
  const v = version || s.version;
  return {
    id: s.id,
    name: s.name,
    version: v,
    publisher: s.publisher,
    publisherUrl: s.homepage,
    publisherSupportUrl: s.homepage,
    author: s.publisher,
    moniker: s.name.toLowerCase().split(" ")[0],
    description: s.description,
    homepage: s.homepage,
    license: s.license,
    licenseUrl: s.homepage + "license",
    privacyUrl: "",
    copyright: `Copyright (c) ${s.publisher}`,
    copyrightUrl: "",
    releaseNotes: "Bug fixes and performance improvements.\n\nUpdated bundled dependencies.",
    releaseNotesUrl: s.homepage + "releases",
    tags: s.tags,
    documentation: [{ label: "Documentation", url: s.homepage + "docs" }],
    installers: [
      {
        installerType: s.type,
        architecture: "x64",
        locale: "en-US",
        scope: "",
        downloadUrl: `https://downloads.example.com/${s.id.toLowerCase()}/${v}/setup-x64.${s.type === "msi" ? "msi" : "exe"}`,
        sha256: "9F2C6A1E5B7D3A48C0E1F7B2D4A6C8E0135792468ACE0BDF13579BDF02468ACE".slice(0, 64),
        releaseDate: "2024-11-20",
        storeProductId: "",
        offlineDistribution: "",
      },
    ],
  };
}

let installed: InstalledPackage[] = [
  { name: "Visual Studio Code", id: "Microsoft.VisualStudioCode", version: "1.94.2", available: "1.95.3", source: "winget" },
  { name: "Git", id: "Git.Git", version: "2.46.0", available: "2.47.1", source: "winget" },
  { name: "7-Zip", id: "7zip.7zip", version: "24.09", available: "", source: "winget" },
  { name: "VLC media player", id: "VideoLAN.VLC", version: "3.0.20", available: "3.0.21", source: "winget" },
  { name: "Mozilla Firefox", id: "Mozilla.Firefox", version: "133.0", available: "", source: "winget" },
  { name: "Notepad++", id: "Notepad++.Notepad++", version: "8.7.1", available: "8.7.3", source: "winget" },
  { name: "Microsoft PowerToys", id: "Microsoft.PowerToys", version: "0.86.0", available: "", source: "winget" },
  { name: "Windows Terminal", id: "Microsoft.WindowsTerminal", version: "1.21.3231.0", available: "", source: "winget" },
  { name: "Spotify", id: "Spotify.Spotify", version: "1.2.50", available: "1.2.52", source: "winget" },
  { name: "Legacy Label Printer Driver", id: "ARP\\Machine\\X64\\LabelPrinter", version: "4.2.1", available: "", source: "" },
  { name: "Microsoft Edge", id: "Microsoft.Edge", version: "131.0.2903.70", available: "", source: "winget" },
  { name: "Microsoft Visual C++ 2015-2022 Redistributable (x64)", id: "Microsoft.VCRedist.2015+.x64", version: "14.40.33810", available: "", source: "winget" },
];

const explicitUpgrades: InstalledPackage[] = [
  { name: "Pinned Studio Tool", id: "Vendor.PinnedStudio", version: "Unknown", available: "5.0", source: "winget" },
];

const tasks: Task[] = [];
const listeners = new Set<(t: Task) => void>();
const logs = new Map<string, string[]>();
let counter = 0;

function emit(t: Task) {
  listeners.forEach((l) => l({ ...t }));
}

function patch(t: Task, p: Partial<Task>) {
  Object.assign(t, p);
  emit(t);
}

const isCancelled = (t: Task) => (t.status as string) === "cancelled";
const queue: string[] = [];
let running = false;

async function runNext() {
  if (running) return;
  const id = queue.shift();
  if (!id) return;
  const t = tasks.find((x) => x.taskId === id);
  if (!t || t.status !== "queued") return runNext();
  running = true;
  const log = (line: string) => {
    logs.get(id)?.push(line);
    patch(t, { lastLine: line });
  };
  patch(t, { status: "running", startedAt: Date.now(), lastLine: "Starting" });
  const sample = BY_ID.get(t.id.toLowerCase());
  if (t.kind === "install" || t.kind === "upgrade" || t.kind === "download") {
    log(`Found ${t.name} [${t.id}] Version ${t.version ?? sample?.version ?? ""}`);
    log("This application is licensed to you by its owner.");
    patch(t, { phase: "downloading" });
    log(`Downloading https://downloads.example.com/${t.id.toLowerCase()}/setup-x64.exe`);
    for (let i = 0; i <= 20; i++) {
      if (isCancelled(t)) break;
      patch(t, { progress: i / 20, progressLabel: `${((i / 20) * 64).toFixed(1)} MB / 64.0 MB` });
      await delay(180);
    }
  }
  if (!isCancelled(t)) {
    if (t.kind === "download") {
      patch(t, { status: "succeeded", progress: 1, phase: null, outputPath: "C:\\Users\\you\\Downloads\\Winget Store", lastLine: "Installer downloaded", finishedAt: Date.now() });
    } else {
      log("Successfully verified installer hash");
      patch(t, { phase: t.kind === "uninstall" ? "uninstalling" : "installing", progress: null, progressLabel: null });
      log(t.kind === "uninstall" ? "Starting package uninstall..." : "Starting package install...");
      await delay(1600);
      if (!isCancelled(t)) {
        if (t.kind === "uninstall") {
          installed = installed.filter((p) => p.id.toLowerCase() !== t.id.toLowerCase());
          log("Successfully uninstalled");
        } else {
          const existing = installed.find((p) => p.id.toLowerCase() === t.id.toLowerCase());
          const v = t.version || sample?.version || "1.0";
          if (existing) {
            existing.version = existing.available || v;
            existing.available = "";
          } else {
            installed = [...installed, { name: t.name, id: t.id, version: v, available: "", source: t.source || "winget" }];
          }
          log("Successfully installed");
        }
        patch(t, { status: "succeeded", progress: 1, phase: null, finishedAt: Date.now() });
      }
    }
  }
  running = false;
  runNext();
}

export const mockApi: Api = {
  isMock: true,
  async wingetStatus() {
    await delay(150);
    return { available: true, version: "v1.9.25200 (sample data)" };
  },
  async searchPackages(query) {
    await delay(500);
    const q = query.trim().toLowerCase();
    const hits = S.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q)),
    );
    return hits.map<PackageSummary>((s) => ({
      name: s.name,
      id: s.id,
      version: s.version,
      source: "winget",
      matchHint: s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) ? "" : `Tag: ${q}`,
    }));
  },
  async listInstalled() {
    await delay(600);
    return installed.map((p) => ({ ...p }));
  },
  async listUpgrades() {
    await delay(700);
    const out: UpgradeList = { upgrades: installed.filter((p) => p.available).map((p) => ({ ...p })), explicit: explicitUpgrades };
    return out;
  },
  async packageDetails(id, _source, version) {
    await delay(350 + Math.random() * 500);
    const s = BY_ID.get(id.toLowerCase());
    if (!s) throw new Error("No package found matching input criteria.");
    return toDetails(s, version);
  },
  async packageVersions(id) {
    await delay(400);
    const s = BY_ID.get(id.toLowerCase());
    if (!s) throw new Error("No package found matching input criteria.");
    const parts = s.version.split(".");
    const out = [s.version];
    for (let i = 1; i <= 7; i++) {
      const p = [...parts];
      const last = Math.max(0, (parseInt(p[p.length - 1], 10) || 0) - i);
      p[p.length - 1] = String(last);
      out.push(p.join("."));
    }
    return out;
  },
  async refreshSources() {
    await delay(900);
    return "Package sources are up to date.";
  },
  async enqueue(requests: TaskRequest[]) {
    const created = requests.map<Task>((r) => {
      counter += 1;
      const t: Task = {
        taskId: `m${counter}`,
        kind: r.kind,
        id: r.id,
        name: r.name,
        source: r.source ?? null,
        version: r.version ?? null,
        status: "queued",
        progress: null,
        progressLabel: null,
        phase: null,
        lastLine: "Waiting in queue",
        createdAt: Date.now(),
      };
      tasks.push(t);
      logs.set(t.taskId, []);
      queue.push(t.taskId);
      setTimeout(() => emit(t), 0);
      return { ...t };
    });
    setTimeout(runNext, 50);
    return created;
  },
  async cancelTask(taskId) {
    const t = tasks.find((x) => x.taskId === taskId);
    if (t && (t.status === "queued" || t.status === "running")) {
      patch(t, { status: "cancelled", lastLine: "Cancelled", finishedAt: Date.now(), phase: null });
    }
  },
  async listTasks() {
    return tasks.map((t) => ({ ...t }));
  },
  async taskLog(taskId) {
    return [...(logs.get(taskId) ?? [])];
  },
  async clearFinished() {
    for (let i = tasks.length - 1; i >= 0; i--) {
      if (tasks[i].status !== "queued" && tasks[i].status !== "running") tasks.splice(i, 1);
    }
  },
  async onTaskUpdate(cb) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  async openUrl(url) {
    window.open(url, "_blank", "noopener");
  },
  async revealPath(path) {
    window.alert(`Would reveal: ${path}`);
  },
  async launchApp() {
    throw new Error("Launching installed apps is only available in the Windows desktop app.");
  },
};

export const MOCK_CURATED_IDS = S.map((s) => s.id);
