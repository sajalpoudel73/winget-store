use crate::model::Progress;
use regex::Regex;
use std::sync::OnceLock;

fn size_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"(?i)(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB)\s*/\s*(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB)").unwrap()
    })
}

fn percent_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"^[\u{2588}\u{2592}\u{2591}\u{2593}\s]*(\d{1,3})\s?%\s*$").unwrap())
}

fn to_bytes(num: &str, unit: &str) -> f64 {
    let n: f64 = num.replace(',', ".").parse().unwrap_or(0.0);
    let mult = match unit.to_ascii_uppercase().as_str() {
        "KB" => 1024.0,
        "MB" => 1024.0 * 1024.0,
        "GB" => 1024.0 * 1024.0 * 1024.0,
        _ => 1.0,
    };
    n * mult
}

fn is_bar_char(c: char) -> bool {
    matches!(c, '\u{2588}' | '\u{2592}' | '\u{2591}' | '\u{2593}')
}

/// Recognises winget's download progress lines:
///   `  ██████▒▒▒▒  32.0 MB / 80.1 MB`, `  45%`, or a bare bar.
/// Returns `None` for ordinary log lines.
pub fn parse_progress(line: &str) -> Option<Progress> {
    let t = line.trim();
    if t.is_empty() {
        return None;
    }
    if let Some(c) = size_re().captures(t) {
        let cur = to_bytes(&c[1], &c[2]);
        let total = to_bytes(&c[3], &c[4]);
        let fraction = if total > 0.0 { Some((cur / total).clamp(0.0, 1.0) as f32) } else { None };
        return Some(Progress { fraction, label: format!("{} {} / {} {}", &c[1], &c[2], &c[3], &c[4]) });
    }
    if let Some(c) = percent_re().captures(t) {
        let p: f32 = c[1].parse().unwrap_or(0.0);
        return Some(Progress { fraction: Some((p / 100.0).clamp(0.0, 1.0)), label: format!("{}%", &c[1]) });
    }
    if t.chars().all(|c| is_bar_char(c) || c.is_whitespace()) {
        let filled = t.chars().filter(|c| *c == '\u{2588}').count() as f32;
        let total = t.chars().filter(|c| is_bar_char(*c)).count() as f32;
        if total > 0.0 {
            return Some(Progress { fraction: Some(filled / total), label: String::new() });
        }
    }
    None
}

/// True for the single-character spinner frames winget prints (`-`, `\`, `|`, `/`).
pub fn is_spinner(line: &str) -> bool {
    let t = line.trim();
    t.chars().count() == 1 && matches!(t, "-" | "\\" | "|" | "/")
}

/// Coarse phase detection from English log lines. Returns `None` when the line says nothing about phase.
pub fn detect_phase(line: &str) -> Option<&'static str> {
    let l = line.to_lowercase();
    if l.contains("downloading") {
        Some("downloading")
    } else if l.contains("starting package install") || l.contains("installing") {
        Some("installing")
    } else if l.contains("starting package uninstall") || l.contains("uninstalling") {
        Some("uninstalling")
    } else if l.contains("successfully verified installer hash") {
        Some("verifying")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_progress() {
        let p = parse_progress("  ██████████▒▒▒▒▒▒▒▒▒▒  40.0 MB / 80.0 MB").unwrap();
        assert_eq!(p.fraction, Some(0.5));
        assert_eq!(p.label, "40.0 MB / 80.0 MB");
    }

    #[test]
    fn size_progress_mixed_units() {
        let p = parse_progress("512 KB / 1 MB").unwrap();
        assert_eq!(p.fraction, Some(0.5));
    }

    #[test]
    fn percent_progress() {
        assert_eq!(parse_progress("  45%").unwrap().fraction, Some(0.45));
        assert_eq!(parse_progress("██████▒▒▒▒ 60 %").unwrap().fraction, Some(0.6));
    }

    #[test]
    fn bare_bar() {
        let p = parse_progress("██▒▒").unwrap();
        assert_eq!(p.fraction, Some(0.5));
    }

    #[test]
    fn ordinary_lines_are_not_progress() {
        assert!(parse_progress("Found Git [Git.Git] Version 2.47.0").is_none());
        assert!(parse_progress("Downloading https://example.com/a.exe").is_none());
        assert!(parse_progress("Successfully installed").is_none());
        assert!(parse_progress("").is_none());
    }

    #[test]
    fn spinner_and_phase() {
        assert!(is_spinner(" \\ "));
        assert!(!is_spinner("--"));
        assert_eq!(detect_phase("Downloading https://x/y.exe"), Some("downloading"));
        assert_eq!(detect_phase("Starting package install..."), Some("installing"));
        assert_eq!(detect_phase("Starting package uninstall..."), Some("uninstalling"));
        assert_eq!(detect_phase("Found something"), None);
    }
}
