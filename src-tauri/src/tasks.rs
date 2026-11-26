use crate::runner;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
#[cfg(not(windows))]
use std::process::Stdio;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
#[cfg(not(windows))]
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::sync::mpsc;

const MAX_LOG_LINES: usize = 500;
/// winget's exit code when the install finished but Windows must restart (ERROR_SUCCESS_REBOOT_REQUIRED).
const REBOOT_REQUIRED: i32 = 3010;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskKind {
    Install,
    Upgrade,
    Uninstall,
    Download,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRequest {
    pub kind: TaskKind,
    pub id: String,
    pub name: String,
    pub source: Option<String>,
    pub version: Option<String>,
    /// "user" or "machine"; anything else means winget's default.
    pub scope: Option<String>,
    pub force: Option<bool>,
    pub purge: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub task_id: String,
    pub kind: TaskKind,
    pub id: String,
    pub name: String,
    pub source: Option<String>,
    pub version: Option<String>,
    pub status: TaskStatus,
    /// 0.0..=1.0 while a download reports progress; `None` means indeterminate.
    pub progress: Option<f32>,
    pub progress_label: Option<String>,
    /// "downloading", "verifying", "installing", "uninstalling"
    pub phase: Option<String>,
    pub last_line: String,
    pub exit_code: Option<u32>,
    pub error: Option<String>,
    pub note: Option<String>,
    pub output_path: Option<String>,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
}

#[derive(Default)]
struct Inner {
    tasks: Vec<Task>,
    requests: HashMap<String, TaskRequest>,
    logs: HashMap<String, Vec<String>>,
    pids: HashMap<String, u32>,
    cancelled: HashSet<String>,
    counter: u64,
}

#[derive(Clone)]
pub struct TaskManager {
    inner: Arc<Mutex<Inner>>,
    tx: mpsc::UnboundedSender<String>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn lock(m: &Mutex<Inner>) -> MutexGuard<'_, Inner> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn valid_source(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

fn sanitize_dir(s: &str) -> String {
    s.chars().map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' { c } else { '_' }).collect()
}

fn kill_tree(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(runner::CREATE_NO_WINDOW)
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill").arg(pid.to_string()).status();
    }
}

impl TaskManager {
    pub fn new(tx: mpsc::UnboundedSender<String>) -> Self {
        Self { inner: Arc::new(Mutex::new(Inner::default())), tx }
    }

    pub fn enqueue(&self, app: &AppHandle, requests: Vec<TaskRequest>) -> Result<Vec<Task>, String> {
        for r in &requests {
            runner::check_arg("Package id", &r.id)?;
            if let Some(v) = &r.version {
                if !v.is_empty() {
                    runner::check_arg("Version", v)?;
                }
            }
        }
        let mut created = Vec::new();
        for r in requests {
            let task = {
                let mut g = lock(&self.inner);
                g.counter += 1;
                let task_id = format!("t{}-{}", now_ms(), g.counter);
                let task = Task {
                    task_id: task_id.clone(),
                    kind: r.kind,
                    id: r.id.clone(),
                    name: r.name.clone(),
                    source: r.source.clone().filter(|s| !s.is_empty()),
                    version: r.version.clone().filter(|s| !s.is_empty()),
                    status: TaskStatus::Queued,
                    progress: None,
                    progress_label: None,
                    phase: None,
                    last_line: "Waiting in queue".to_string(),
                    exit_code: None,
                    error: None,
                    note: None,
                    output_path: None,
                    created_at: now_ms(),
                    started_at: None,
                    finished_at: None,
                };
                g.tasks.push(task.clone());
                g.requests.insert(task_id, r);
                task
            };
            let _ = app.emit("task-update", &task);
            let _ = self.tx.send(task.task_id.clone());
            created.push(task);
        }
        Ok(created)
    }

    pub fn cancel(&self, app: &AppHandle, task_id: &str) {
        let (pid, queued) = {
            let mut g = lock(&self.inner);
            let status = g.tasks.iter().find(|t| t.task_id == task_id).map(|t| t.status);
            match status {
                Some(TaskStatus::Queued) => (None, true),
                Some(TaskStatus::Running) => {
                    g.cancelled.insert(task_id.to_string());
                    (g.pids.get(task_id).copied(), false)
                }
                _ => return,
            }
        };
        if queued {
            self.update(app, task_id, |t| {
                t.status = TaskStatus::Cancelled;
                t.last_line = "Cancelled".to_string();
                t.finished_at = Some(now_ms());
            });
        } else if let Some(pid) = pid {
            kill_tree(pid);
        }
    }

    pub fn list(&self) -> Vec<Task> {
        lock(&self.inner).tasks.clone()
    }

    pub fn log(&self, task_id: &str) -> Vec<String> {
        lock(&self.inner).logs.get(task_id).cloned().unwrap_or_default()
    }

    pub fn clear_finished(&self) {
        let mut g = lock(&self.inner);
        let keep: Vec<Task> = g
            .tasks
            .iter()
            .filter(|t| matches!(t.status, TaskStatus::Queued | TaskStatus::Running))
            .cloned()
            .collect();
        let ids: HashSet<String> = keep.iter().map(|t| t.task_id.clone()).collect();
        g.requests.retain(|k, _| ids.contains(k));
        g.logs.retain(|k, _| ids.contains(k));
        g.tasks = keep;
    }

    fn update<F: FnOnce(&mut Task)>(&self, app: &AppHandle, task_id: &str, f: F) {
        let snapshot = {
            let mut g = lock(&self.inner);
            g.tasks.iter_mut().find(|t| t.task_id == task_id).map(|t| {
                f(t);
                t.clone()
            })
        };
        if let Some(t) = snapshot {
            let _ = app.emit("task-update", &t);
        }
    }

    fn push_log(&self, task_id: &str, line: &str) {
        let mut g = lock(&self.inner);
        let log = g.logs.entry(task_id.to_string()).or_default();
        log.push(line.to_string());
        if log.len() > MAX_LOG_LINES {
            let excess = log.len() - MAX_LOG_LINES;
            log.drain(..excess);
        }
    }
}

/// Builds the winget argument list for a request. For downloads also returns the target folder.
fn build_args(app: &AppHandle, r: &TaskRequest) -> Result<(Vec<String>, Option<String>), String> {
    let verb = match r.kind {
        TaskKind::Install => "install",
        TaskKind::Upgrade => "upgrade",
        TaskKind::Uninstall => "uninstall",
        TaskKind::Download => "download",
    };
    let mut a = runner::args(&[verb, "--id", &r.id, "--exact"]);
    let source = r.source.as_deref().filter(|s| valid_source(s));
    let version = r.version.as_deref().filter(|v| !v.is_empty());
    let mut out_dir = None;

    match r.kind {
        TaskKind::Install | TaskKind::Upgrade | TaskKind::Download => {
            if let Some(s) = source {
                a.extend(runner::args(&["--source", s]));
            }
            if let Some(v) = version {
                a.extend(runner::args(&["--version", v]));
            }
            a.push("--accept-package-agreements".into());
        }
        TaskKind::Uninstall => {}
    }

    match r.kind {
        TaskKind::Install | TaskKind::Upgrade => {
            a.push("--silent".into());
            if matches!(r.scope.as_deref(), Some("user") | Some("machine")) && r.kind == TaskKind::Install {
                a.extend(runner::args(&["--scope", r.scope.as_deref().unwrap_or("user")]));
            }
            if r.force == Some(true) {
                a.push("--force".into());
            }
        }
        TaskKind::Uninstall => {
            a.push("--silent".into());
            if r.purge == Some(true) {
                a.push("--purge".into());
            }
        }
        TaskKind::Download => {
            let base = app.path().download_dir().map_err(|e| format!("Could not find the Downloads folder: {e}"))?;
            let dir = base
                .join("Winget Store")
                .join(format!("{}-{}", sanitize_dir(&r.id), sanitize_dir(version.unwrap_or("latest"))));
            std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
            let dir_s = dir.to_string_lossy().to_string();
            a.extend(runner::args(&["--download-directory", &dir_s]));
            out_dir = Some(dir_s);
        }
    }
    a.extend(runner::COMMON.iter().map(|s| s.to_string()));
    Ok((a, out_dir))
}

fn forward_lines(pending: &mut Vec<u8>, tx: &mpsc::UnboundedSender<String>) -> bool {
    while let Some(pos) = pending.iter().position(|b| *b == b'\n' || *b == b'\r') {
        let line: Vec<u8> = pending.drain(..=pos).collect();
        let text = String::from_utf8_lossy(&line[..line.len() - 1]).into_owned();
        if tx.send(text).is_err() {
            return false;
        }
    }
    true
}

fn forward_remainder(pending: &[u8], tx: &mpsc::UnboundedSender<String>) {
    if !pending.is_empty() {
        let _ = tx.send(String::from_utf8_lossy(pending).into_owned());
    }
}

#[cfg(not(windows))]
async fn pump<R: AsyncRead + Unpin>(mut reader: R, tx: mpsc::UnboundedSender<String>) {
    let mut buf = [0u8; 4096];
    let mut pending: Vec<u8> = Vec::new();
    loop {
        match reader.read(&mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                pending.extend_from_slice(&buf[..n]);
                // \r and \n never appear inside a multi-byte UTF-8 sequence, so splitting bytes is safe.
                if !forward_lines(&mut pending, &tx) {
                    return;
                }
            }
        }
    }
    forward_remainder(&pending, &tx);
}

#[cfg(windows)]
struct WingetChild {
    child: Box<dyn portable_pty::Child + Send + Sync>,
    master: Option<Box<dyn portable_pty::MasterPty + Send>>,
}

#[cfg(not(windows))]
struct WingetChild(tokio::process::Child);

impl WingetChild {
    fn close_output(&mut self) {
        #[cfg(windows)]
        {
            self.master.take();
        }
    }

    fn id(&self) -> Option<u32> {
        #[cfg(windows)]
        {
            self.child.process_id()
        }
        #[cfg(not(windows))]
        {
            self.0.id()
        }
    }

    #[cfg(windows)]
    async fn wait(&mut self) -> Option<i32> {
        loop {
            match self.child.try_wait() {
                Ok(Some(status)) => return Some(status.exit_code() as i32),
                Ok(None) => tokio::time::sleep(Duration::from_millis(100)).await,
                Err(_) => return None,
            }
        }
    }

    #[cfg(not(windows))]
    async fn wait(&mut self) -> Option<i32> {
        self.0.wait().await.ok().and_then(|status| status.code())
    }
}

fn answer_cursor_position_query<W: std::io::Write>(
    bytes: &[u8],
    pending: &mut Vec<u8>,
    writer: &mut W,
) -> std::io::Result<()> {
    pending.extend_from_slice(bytes);
    while let Some(pos) = pending.windows(4).position(|window| window == b"\x1b[6n") {
        writer.write_all(b"\x1b[1;1R")?;
        pending.drain(..pos + 4);
    }
    if pending.len() > 3 {
        pending.drain(..pending.len() - 3);
    }
    Ok(())
}

#[cfg(windows)]
fn pump_blocking<R: std::io::Read, W: std::io::Write>(
    mut reader: R,
    mut writer: W,
    process_id: Option<u32>,
    tx: mpsc::UnboundedSender<String>,
) {
    let mut buf = [0u8; 4096];
    let mut pending = Vec::new();
    let mut query_pending = Vec::new();
    loop {
        match reader.read(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                if let Err(e) =
                    answer_cursor_position_query(&buf[..n], &mut query_pending, &mut writer)
                {
                    let _ = tx.send(format!("Could not respond to winget terminal query: {e}"));
                    if let Some(pid) = process_id {
                        kill_tree(pid);
                    }
                    return;
                }
                pending.extend_from_slice(&buf[..n]);
                if !forward_lines(&mut pending, &tx) {
                    return;
                }
            }
        }
    }
    forward_remainder(&pending, &tx);
}

#[cfg(windows)]
fn spawn_winget(args: &[String]) -> Result<(WingetChild, mpsc::UnboundedReceiver<String>), String> {
    use portable_pty::{native_pty_system, CommandBuilder, PtySize};

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 30,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Could not create a winget terminal: {e}"))?;
    let master = pair.master;
    let reader = master
        .try_clone_reader()
        .map_err(|e| format!("Could not read winget output: {e}"))?;
    let writer = master
        .take_writer()
        .map_err(|e| format!("Could not initialize winget input: {e}"))?;

    let mut command = CommandBuilder::new("winget");
    command.args(args);
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| format!("Could not start winget: {e}"))?;
    drop(pair.slave);
    let process_id = child.process_id();

    let (tx, rx) = mpsc::unbounded_channel();
    let output_tx = tx.clone();
    if let Err(e) = std::thread::Builder::new()
        .name("winget-output".to_string())
        .spawn(move || pump_blocking(reader, writer, process_id, output_tx))
    {
        let _ = child.kill();
        return Err(format!("Could not read winget output: {e}"));
    }
    drop(tx);

    Ok((
        WingetChild {
            child,
            master: Some(master),
        },
        rx,
    ))
}

#[cfg(not(windows))]
fn spawn_winget(args: &[String]) -> Result<(WingetChild, mpsc::UnboundedReceiver<String>), String> {
    let mut command = runner::winget_command();
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(runner::spawn_error)?;

    let (tx, rx) = mpsc::unbounded_channel();
    if let Some(stdout) = child.stdout.take() {
        tauri::async_runtime::spawn(pump(stdout, tx.clone()));
    }
    if let Some(stderr) = child.stderr.take() {
        tauri::async_runtime::spawn(pump(stderr, tx.clone()));
    }
    drop(tx);

    Ok((WingetChild(child), rx))
}

fn handle_task_output(
    app: &AppHandle,
    mgr: &TaskManager,
    task_id: &str,
    raw: String,
    last_emit: &mut Instant,
) {
    let clean = winget_core::strip_ansi(&raw);
    let line = clean.trim();
    if line.is_empty() || winget_core::is_spinner(line) {
        return;
    }
    if let Some(p) = winget_core::parse_progress(line) {
        if last_emit.elapsed() >= Duration::from_millis(120) {
            *last_emit = Instant::now();
            mgr.push_log(task_id, line);
            mgr.update(app, task_id, |t| {
                t.progress = p.fraction;
                t.progress_label = if p.label.is_empty() {
                    None
                } else {
                    Some(p.label.clone())
                };
                t.phase = Some("downloading".to_string());
            });
        }
    } else {
        mgr.push_log(task_id, line);
        let phase = winget_core::detect_phase(line);
        let text = line.to_string();
        mgr.update(app, task_id, |t| {
            t.last_line = text;
            if let Some(p) = phase {
                t.phase = Some(p.to_string());
                if p != "downloading" {
                    t.progress = None;
                    t.progress_label = None;
                }
            }
        });
    }
}

fn fail(mgr: &TaskManager, app: &AppHandle, task_id: &str, msg: String) {
    mgr.update(app, task_id, |t| {
        t.status = TaskStatus::Failed;
        t.error = Some(msg.clone());
        t.last_line = msg;
        t.finished_at = Some(now_ms());
    });
}

async fn run_task(app: &AppHandle, mgr: &TaskManager, task_id: &str) {
    let request = {
        let g = lock(&mgr.inner);
        match g.tasks.iter().find(|t| t.task_id == task_id) {
            Some(t) if t.status == TaskStatus::Queued => g.requests.get(task_id).cloned(),
            _ => None,
        }
    };
    let Some(request) = request else { return };

    mgr.update(app, task_id, |t| {
        t.status = TaskStatus::Running;
        t.started_at = Some(now_ms());
        t.last_line = "Starting".to_string();
    });

    let (args, out_dir) = match build_args(app, &request) {
        Ok(v) => v,
        Err(e) => return fail(mgr, app, task_id, e),
    };

    let (mut child, mut lrx) = match spawn_winget(&args) {
        Ok(v) => v,
        Err(e) => return fail(mgr, app, task_id, e),
    };
    if let Some(pid) = child.id() {
        lock(&mgr.inner).pids.insert(task_id.to_string(), pid);
    }

    let mut last_emit = Instant::now() - Duration::from_secs(1);
    let mut wait = Box::pin(child.wait());
    let code = loop {
        tokio::select! {
            raw = lrx.recv() => match raw {
                Some(raw) => handle_task_output(app, mgr, task_id, raw, &mut last_emit),
                None => break wait.await,
            },
            code = &mut wait => {
                drop(wait);
                child.close_output();
                while let Some(raw) = lrx.recv().await {
                    handle_task_output(app, mgr, task_id, raw, &mut last_emit);
                }
                break code;
            }
        }
    };
    let cancelled = {
        let mut g = lock(&mgr.inner);
        g.pids.remove(task_id);
        g.cancelled.remove(task_id)
    };
    let log_tail = mgr.log(task_id).into_iter().last();

    mgr.update(app, task_id, |t| {
        t.exit_code = code.map(|c| c as u32);
        t.finished_at = Some(now_ms());
        t.phase = None;
        if cancelled {
            t.status = TaskStatus::Cancelled;
            t.last_line = "Cancelled".to_string();
        } else if code == Some(0) || code == Some(REBOOT_REQUIRED) {
            t.status = TaskStatus::Succeeded;
            t.progress = Some(1.0);
            if code == Some(REBOOT_REQUIRED) {
                t.note = Some("Restart Windows to finish.".to_string());
            }
            t.output_path = out_dir.clone();
        } else {
            let msg = log_tail.clone().unwrap_or_else(|| match code {
                Some(c) => format!("winget exited with code 0x{:08X}", c as u32),
                None => "winget was stopped".to_string(),
            });
            t.status = TaskStatus::Failed;
            t.error = Some(msg.clone());
            t.last_line = msg;
        }
    });
}

/// Runs queued tasks one at a time; installers do not tolerate running side by side.
pub async fn worker(app: AppHandle, mgr: TaskManager, mut rx: mpsc::UnboundedReceiver<String>) {
    while let Some(task_id) = rx.recv().await {
        run_task(&app, &mgr, &task_id).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_cursor_position_queries_split_across_reads() {
        let mut pending = Vec::new();
        let mut response = Vec::new();
        answer_cursor_position_query(b"\x1b[", &mut pending, &mut response).unwrap();
        answer_cursor_position_query(b"6n", &mut pending, &mut response).unwrap();
        assert_eq!(response, b"\x1b[1;1R");
    }
}
