# Winget Store

Winget Store is a Windows desktop app for browsing and managing packages with
[`winget`](https://learn.microsoft.com/windows/package-manager/winget/). It provides
search and package details, install/update/uninstall actions, older-version downloads,
and an activity view for queued tasks.

**Status:** early-stage project (`0.1.0`). Live download progress during a Windows
package update has been manually verified. Broader install, uninstall, localization,
and installer compatibility coverage is still in progress.

**Stack:** Tauri 2, Rust, React, and TypeScript.

## AI development disclosure

This app was developed with AI assistance, including Anthropic Claude and GitHub Copilot.
Human contributors reviewed and tested the project, but AI-generated output may still
contain errors.

## Requirements

- Windows 10 version 1809 or later, or Windows 11
- [Rust](https://rustup.rs/)
- Node.js 20+
- WebView2 (included with Windows 11; available for supported Windows 10 versions)
- WinGet, provided by Microsoft's App Installer

## Run from source

```powershell
npm ci
npm run tauri dev
```

Build the Windows installer:

```powershell
npm run tauri build
```

The NSIS installer is written under `target\release\bundle\nsis` at the workspace root.

Other useful checks:

```powershell
npm run build             # Type-check and build the frontend
cargo test --workspace    # Run Rust tests
npm run dev               # Run the UI with sample data; WinGet is not used
```

## Features

- Search WinGet packages and view publisher, description, license, installer details,
  release notes, and older versions.
- Install, update, uninstall, or download installers using the machine's WinGet CLI.
- Queue package tasks, see live download progress, cancel tasks, and inspect task output.
- Launch installed apps when a matching Start Menu shortcut is found.
- Browse installed packages and available updates.

## Architecture

| Area | Location | Notes |
| --- | --- | --- |
| Output parsing | `crates/winget-core` | Parses WinGet tables, `Key: value` output, and download progress. Includes 18 parser tests. |
| WinGet commands | `src-tauri/src/runner.rs` | Runs WinGet with timeouts, argument checks, and hidden console handling. |
| Task queue | `src-tauri/src/tasks.rs` | Runs one task at a time; uses a hidden pseudo-console on Windows to capture live progress. Tasks can be cancelled, and exit code 3010 is treated as success requiring a restart. |
| Frontend | `src/` | React and TypeScript UI for discovery, search, installed apps, updates, activity, settings, and package details. |

## Data, sources, and installer trust

Winget Store is an independent community project and is not affiliated with or endorsed by
Microsoft.

- Package data and package operations come from the WinGet CLI and its configured sources.
  The app does not independently audit package manifests or installer binaries. Review
  the package ID, source, publisher, and any Windows elevation prompt before proceeding.
- Package icons may be loaded from external package-related websites. Online icons can be
  disabled in Settings.
- Package details are loaded lazily and cached for a week.
- The app uses WinGet's default source data. Private sources can be used through WinGet,
  but do not have curated discovery shelves.

## Limitations

- WinGet's human-readable output varies by version and locale. Table parsing is primarily
  tested against English output; heavily localized output may be misaligned.
- Some installers ignore silent-install options or display their own UI. Uninstalling may
  require administrator approval.
- Downloading or installing an older version depends on the package manifest and installer.
- Automated tests do not install or update third-party packages. The live progress UI has
  been manually verified during a Windows package update, but broader end-to-end testing
  remains necessary.

## Contributing

Bug reports and focused pull requests are welcome. When reporting a parsing problem, include
the WinGet command, WinGet version, locale, and a sanitized excerpt of its output. Do not
include personal paths or other private information in logs.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
