export interface Category {
  key: string;
  label: string;
  ids: string[];
}

/** Starting points for Discover. winget has no "featured" feed, so these are hand-picked; ids that no longer exist are skipped quietly. */
export const CATEGORIES: Category[] = [
  { key: "browsers", label: "Browsers", ids: ["Mozilla.Firefox", "Google.Chrome", "Brave.Brave", "Vivaldi.Vivaldi", "Opera.Opera"] },
  {
    key: "dev",
    label: "Developer tools",
    ids: ["Microsoft.VisualStudioCode", "Git.Git", "Python.Python.3.13", "OpenJS.NodeJS.LTS", "Docker.DockerDesktop", "Microsoft.WindowsTerminal", "GitHub.GitHubDesktop", "Postman.Postman", "Rustlang.Rustup", "JetBrains.Toolbox"],
  },
  { key: "media", label: "Media and creative", ids: ["VideoLAN.VLC", "OBSProject.OBSStudio", "Spotify.Spotify", "Audacity.Audacity", "HandBrake.HandBrake", "BlenderFoundation.Blender", "Inkscape.Inkscape", "KDE.Krita"] },
  { key: "utilities", label: "Utilities", ids: ["Microsoft.PowerToys", "7zip.7zip", "voidtools.Everything", "ShareX.ShareX", "WinDirStat.WinDirStat", "Notepad++.Notepad++", "qBittorrent.qBittorrent"] },
  { key: "chat", label: "Chat and meetings", ids: ["Discord.Discord", "Zoom.Zoom", "Telegram.TelegramDesktop", "SlackTechnologies.Slack", "Signal.Signal"] },
  { key: "productivity", label: "Notes and office", ids: ["Obsidian.Obsidian", "Notion.Notion", "Bitwarden.Bitwarden", "TheDocumentFoundation.LibreOffice", "Adobe.Acrobat.Reader.64-bit"] },
  { key: "games", label: "Games", ids: ["Valve.Steam", "EpicGames.EpicGamesLauncher", "Discord.Discord"] },
];
