mod runner;
mod tasks;

use runner::{args, check_arg, run_capture, COMMON};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tasks::{Task, TaskManager, TaskRequest};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;
use winget_core::{InstalledPackage, PackageDetails, PackageSummary, UpgradeList};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WingetStatus {
    available: bool,
    version: Option<String>,
    error: Option<String>,
}

fn source_args(source: &Option<String>) -> Vec<String> {
    match source.as_deref() {
        Some(s) if !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.')) => {
            vec!["--source".to_string(), s.to_string()]
        }
        _ => vec![],
    }
}

fn with_common(mut a: Vec<String>) -> Vec<String> {
    a.extend(COMMON.iter().map(|s| s.to_string()));
    a
}

#[tauri::command]
async fn winget_status() -> WingetStatus {
    match run_capture(&args(&["--version"]), 20).await {
        Ok(c) if c.code == Some(0) => {
            WingetStatus { available: true, version: Some(c.text.trim().to_string()), error: None }
        }
        Ok(c) => WingetStatus { available: false, version: None, error: Some(c.last_line()) },
        Err(e) => WingetStatus { available: false, version: None, error: Some(e) },
    }
}

#[tauri::command]
async fn search_packages(query: String, source: Option<String>) -> Result<Vec<PackageSummary>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let mut a = args(&["search", "--query", query.trim(), "--count", "60"]);
    a.extend(source_args(&source));
    let out = run_capture(&with_common(a), 60).await?;
    let rows = winget_core::parse_search(&out.text);
    if rows.is_empty() && out.code != Some(0) && !out.looks_empty() {
        return Err(out.last_line());
    }
    Ok(rows)
}

#[tauri::command]
async fn list_installed() -> Result<Vec<InstalledPackage>, String> {
    let out = run_capture(&with_common(args(&["list"])), 120).await?;
    let rows = winget_core::parse_list(&out.text);
    if rows.is_empty() && out.code != Some(0) && !out.looks_empty() {
        return Err(out.last_line());
    }
    Ok(rows)
}

fn normalized_shortcut_name(value: &str) -> String {
    value
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

fn matching_shortcut<'a>(shortcuts: &'a [PathBuf], id: &str, name: &str) -> Option<&'a PathBuf> {
    let name_key = normalized_shortcut_name(name);
    let id_key = id.rsplit('.').next().map(normalized_shortcut_name).unwrap_or_default();
    shortcuts
        .iter()
        .find(|path| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .map(normalized_shortcut_name)
                .as_deref()
                == Some(&name_key)
        })
        .or_else(|| {
            if id_key.is_empty() {
                None
            } else {
                shortcuts.iter().find(|path| {
                    path.file_stem()
                        .and_then(|s| s.to_str())
                        .map(normalized_shortcut_name)
                        .as_deref()
                        == Some(&id_key)
                })
            }
        })
}

fn collect_shortcuts(dir: &Path, shortcuts: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Could not read Start Menu shortcuts: {e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Could not read Start Menu shortcut entry: {e}"))?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|e| format!("Could not inspect Start Menu shortcut: {e}"))?;
        if file_type.is_dir() {
            collect_shortcuts(&path, shortcuts)?;
        } else if file_type.is_file() && path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("lnk")) {
            shortcuts.push(path);
        }
    }
    Ok(())
}

fn find_app_shortcut(id: &str, name: &str) -> Result<PathBuf, String> {
    if normalized_shortcut_name(name).is_empty() {
        return Err("App name is empty.".to_string());
    }
    let mut shortcuts = Vec::new();
    for variable in ["APPDATA", "PROGRAMDATA"] {
        if let Some(root) = std::env::var_os(variable) {
            let programs = PathBuf::from(root).join("Microsoft").join("Windows").join("Start Menu").join("Programs");
            if programs.is_dir() {
                collect_shortcuts(&programs, &mut shortcuts)?;
            }
        }
    }
    shortcuts.sort();
    matching_shortcut(&shortcuts, id, name)
        .cloned()
        .ok_or_else(|| format!("No Start Menu shortcut was found for {name}."))
}

#[tauri::command]
fn launch_installed_app(app: AppHandle, id: String, name: String) -> Result<(), String> {
    let shortcut = find_app_shortcut(&id, &name)?;
    app.opener()
        .open_path(shortcut.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| format!("Could not launch {name}: {e}"))
}

#[cfg(test)]
mod tests {
    use super::matching_shortcut;
    use std::path::PathBuf;

    #[test]
    fn prefers_display_name_match_over_package_id_match() {
        let shortcuts = vec![PathBuf::from("Chrome.lnk"), PathBuf::from("Google Chrome.lnk")];
        let found = matching_shortcut(&shortcuts, "Google.Chrome", "Google Chrome");
        assert_eq!(
            found.and_then(|path| path.file_name()),
            Some(std::ffi::OsStr::new("Google Chrome.lnk"))
        );
    }

    #[test]
    fn matches_shortcut_by_package_id_when_display_name_differs() {
        let shortcuts = vec![PathBuf::from("VisualStudioCode.lnk")];
        let found = matching_shortcut(&shortcuts, "Microsoft.VisualStudioCode", "Visual Studio Code");
        assert_eq!(
            found.and_then(|path| path.file_name()),
            Some(std::ffi::OsStr::new("VisualStudioCode.lnk"))
        );
    }
}

#[tauri::command]
async fn list_upgrades() -> Result<UpgradeList, String> {
    let out = run_capture(&with_common(args(&["upgrade"])), 120).await?;
    let list = winget_core::parse_upgrades(&out.text);
    if list.upgrades.is_empty() && list.explicit.is_empty() && out.code != Some(0) && !out.looks_empty() {
        return Err(out.last_line());
    }
    Ok(list)
}

#[tauri::command]
async fn package_details(id: String, source: Option<String>, version: Option<String>) -> Result<PackageDetails, String> {
    check_arg("Package id", &id)?;
    let mut a = args(&["show", "--id", &id, "--exact"]);
    a.extend(source_args(&source));
    if let Some(v) = version.as_deref().filter(|v| !v.is_empty()) {
        check_arg("Version", v)?;
        a.extend(args(&["--version", v]));
    }
    let out = run_capture(&with_common(a), 60).await?;
    winget_core::parse_show(&out.text).ok_or_else(|| out.last_line())
}

#[tauri::command]
async fn package_versions(id: String, source: Option<String>) -> Result<Vec<String>, String> {
    check_arg("Package id", &id)?;
    let mut a = args(&["show", "--id", &id, "--exact", "--versions"]);
    a.extend(source_args(&source));
    let out = run_capture(&with_common(a), 60).await?;
    let versions = winget_core::parse_versions(&out.text);
    if versions.is_empty() {
        return Err(out.last_line());
    }
    Ok(versions)
}

#[tauri::command]
async fn refresh_sources() -> Result<String, String> {
    let out = run_capture(&with_common(args(&["source", "update"])), 120).await?;
    if out.code == Some(0) {
        Ok("Package sources are up to date.".to_string())
    } else {
        Err(out.last_line())
    }
}

#[tauri::command]
fn enqueue_tasks(app: AppHandle, manager: State<'_, TaskManager>, requests: Vec<TaskRequest>) -> Result<Vec<Task>, String> {
    manager.enqueue(&app, requests)
}

#[tauri::command]
fn cancel_task(app: AppHandle, manager: State<'_, TaskManager>, task_id: String) {
    manager.cancel(&app, &task_id);
}

#[tauri::command]
fn list_tasks(manager: State<'_, TaskManager>) -> Vec<Task> {
    manager.list()
}

#[tauri::command]
fn task_log(manager: State<'_, TaskManager>, task_id: String) -> Vec<String> {
    manager.log(&task_id)
}

#[tauri::command]
fn clear_finished_tasks(manager: State<'_, TaskManager>) {
    manager.clear_finished();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
            let manager = TaskManager::new(tx);
            app.manage(manager.clone());
            tauri::async_runtime::spawn(tasks::worker(app.handle().clone(), manager, rx));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            winget_status,
            search_packages,
            list_installed,
            launch_installed_app,
            list_upgrades,
            package_details,
            package_versions,
            refresh_sources,
            enqueue_tasks,
            cancel_task,
            list_tasks,
            task_log,
            clear_finished_tasks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Winget Store");
}
