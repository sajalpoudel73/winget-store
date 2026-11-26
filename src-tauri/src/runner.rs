use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Flags passed to every winget call that reads data.
pub const COMMON: [&str; 2] = ["--accept-source-agreements", "--disable-interactivity"];

/// A `winget` command that never flashes a console window and is killed if its future is dropped.
pub fn winget_command() -> Command {
    let mut cmd = Command::new("winget");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.kill_on_drop(true);
    cmd
}

pub fn spawn_error(e: std::io::Error) -> String {
    if e.kind() == std::io::ErrorKind::NotFound {
        "winget was not found. Install or update \"App Installer\" from the Microsoft Store.".to_string()
    } else {
        format!("Could not start winget: {e}")
    }
}

pub struct Captured {
    pub text: String,
    pub code: Option<i32>,
}

impl Captured {
    /// Last non-empty line of output, useful as a short error message.
    pub fn last_line(&self) -> String {
        winget_core::clean_lines(&self.text)
            .into_iter()
            .map(|l| l.trim().to_string())
            .filter(|l| !l.is_empty() && !winget_core::is_spinner(l))
            .last()
            .unwrap_or_else(|| "winget returned no output".to_string())
    }

    /// winget reports "nothing found" with a non-zero exit code; that is not an error for us.
    pub fn looks_empty(&self) -> bool {
        let t = self.text.to_lowercase();
        t.contains("no package found")
            || t.contains("no installed package found")
            || t.contains("no applicable")
            || t.contains("no newer package")
    }
}

/// Runs winget to completion and returns its combined stdout/stderr.
pub async fn run_capture(args: &[String], timeout_secs: u64) -> Result<Captured, String> {
    let mut cmd = winget_command();
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let child = cmd.spawn().map_err(spawn_error)?;
    let out = tokio::time::timeout(Duration::from_secs(timeout_secs), child.wait_with_output())
        .await
        .map_err(|_| "winget took too long to respond.".to_string())?
        .map_err(|e| e.to_string())?;
    let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
    if !out.stderr.is_empty() {
        text.push('\n');
        text.push_str(&String::from_utf8_lossy(&out.stderr));
    }
    Ok(Captured { text, code: out.status.code() })
}

/// Rejects empty values and anything that winget could mistake for an option.
pub fn check_arg(label: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{label} is empty"));
    }
    if value.starts_with('-') {
        return Err(format!("{label} is not valid: {value}"));
    }
    Ok(())
}

pub fn args(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}
