use crate::model::*;
use regex::Regex;
use std::sync::OnceLock;
use unicode_width::UnicodeWidthChar;

fn ansi_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))").unwrap()
    })
}

/// Removes ANSI/VT escape sequences.
pub fn strip_ansi(s: &str) -> String {
    ansi_re().replace_all(s, "").into_owned()
}

/// Splits raw winget output into lines.
///
/// winget redraws its spinner and progress bar with bare `\r`, so both `\r` and `\n`
/// are treated as line breaks (after folding `\r\n`, so Windows line endings don't
/// produce phantom blank lines).
pub fn clean_lines(raw: &str) -> Vec<String> {
    strip_ansi(raw)
        .replace("\r\n", "\n")
        .split(|c| c == '\r' || c == '\n')
        .map(|l| l.trim_end().to_string())
        .collect()
}

fn is_separator(line: &str) -> bool {
    let t = line.trim();
    t.len() >= 3 && t.chars().all(|c| c == '-')
}

const KNOWN_HEADERS: [&str; 6] = ["name", "id", "version", "available", "match", "source"];

/// Start offsets (in terminal cells) of each header column.
///
/// With English headers every word is its own column, which stays correct even if a column
/// is separated by a single space. For localised headers (which may contain spaces) a column
/// begins after a gap of two or more spaces.
fn column_starts(header: &str) -> Vec<usize> {
    let mut word_starts = Vec::new();
    let mut gap_starts = Vec::new();
    let mut pos = 0usize;
    let mut space_run = 2usize;
    for ch in header.chars() {
        let w = UnicodeWidthChar::width(ch).unwrap_or(0);
        if ch == ' ' {
            space_run += 1;
        } else {
            if space_run >= 1 {
                word_starts.push(pos);
            }
            if space_run >= 2 {
                gap_starts.push(pos);
            }
            space_run = 0;
        }
        pos += w;
    }
    let all_known = header.split_whitespace().all(|t| KNOWN_HEADERS.contains(&t.to_lowercase().as_str()));
    if all_known {
        word_starts
    } else {
        gap_starts
    }
}

/// Cuts a line into cells using display-width offsets, so rows containing CJK
/// (double-width) characters still line up with the header.
fn slice_columns(line: &str, starts: &[usize]) -> Vec<String> {
    let mut cells = vec![String::new(); starts.len().max(1)];
    let mut pos = 0usize;
    for ch in line.chars() {
        let idx = starts.iter().rposition(|&s| s <= pos).unwrap_or(0);
        cells[idx].push(ch);
        pos += UnicodeWidthChar::width(ch).unwrap_or(0);
    }
    cells.iter().map(|c| c.trim().to_string()).collect()
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Table {
    /// The line printed above the header, if any (used to recognise winget's "explicit targeting" table).
    pub preamble: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// Finds every table (`header` line followed by a `-----` line) in the output.
pub fn parse_tables(raw: &str) -> Vec<Table> {
    let lines = clean_lines(raw);
    let mut tables = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        if i > 0 && is_separator(&lines[i]) && !lines[i - 1].trim().is_empty() {
            let header_line = &lines[i - 1];
            let starts = column_starts(header_line);
            let headers = slice_columns(header_line, &starts);
            let preamble = lines[..i - 1]
                .iter()
                .rev()
                .find(|l| !l.trim().is_empty() && !crate::progress::is_spinner(l))
                .cloned()
                .unwrap_or_default();
            let mut rows = Vec::new();
            let mut j = i + 1;
            while j < lines.len() && !lines[j].trim().is_empty() && !is_separator(&lines[j]) {
                // The line before a new separator is that table's header, not a row.
                if j + 1 < lines.len() && is_separator(&lines[j + 1]) {
                    break;
                }
                rows.push(slice_columns(&lines[j], &starts));
                j += 1;
            }
            tables.push(Table { preamble: preamble.trim().to_string(), headers, rows });
            i = j;
        } else {
            i += 1;
        }
    }
    tables
}

#[derive(Default)]
struct Cols {
    name: Option<usize>,
    id: Option<usize>,
    version: Option<usize>,
    available: Option<usize>,
    source: Option<usize>,
    hint: Option<usize>,
}

fn map_cols(headers: &[String], search: bool) -> Cols {
    let mut c = Cols::default();
    for (i, h) in headers.iter().enumerate() {
        match h.trim().to_lowercase().as_str() {
            "name" => c.name = Some(i),
            "id" => c.id = Some(i),
            "version" => c.version = Some(i),
            "available" => c.available = Some(i),
            "source" => c.source = Some(i),
            "match" => c.hint = Some(i),
            _ => {}
        }
    }
    if c.name.is_some() && c.id.is_some() {
        return c;
    }
    // Localised headers: fall back to winget's fixed column order.
    let n = headers.len();
    let mut c = Cols { name: Some(0), id: Some(1), version: Some(2), ..Default::default() };
    match n {
        0..=3 => {}
        4 => c.source = Some(3),
        _ if search => {
            c.hint = Some(3);
            c.source = Some(4);
        }
        _ => {
            c.available = Some(3);
            c.source = Some(4);
        }
    }
    c
}

fn cell(row: &[String], idx: Option<usize>) -> String {
    idx.and_then(|i| row.get(i)).cloned().unwrap_or_default()
}

fn looks_like_id(id: &str) -> bool {
    !id.contains(' ') && id.chars().any(|c| c.is_alphanumeric())
}

fn to_installed(table: &Table) -> Vec<InstalledPackage> {
    let c = map_cols(&table.headers, false);
    table
        .rows
        .iter()
        .map(|r| InstalledPackage {
            name: cell(r, c.name),
            id: cell(r, c.id),
            version: cell(r, c.version),
            available: cell(r, c.available),
            source: cell(r, c.source),
        })
        // Footer lines such as "3 upgrades available." leave only stray punctuation in the Id cell.
        .filter(|p| looks_like_id(&p.id))
        .collect()
}

pub fn parse_search(raw: &str) -> Vec<PackageSummary> {
    let Some(table) = parse_tables(raw).into_iter().next() else {
        return Vec::new();
    };
    let c = map_cols(&table.headers, true);
    table
        .rows
        .iter()
        .map(|r| PackageSummary {
            name: cell(r, c.name),
            id: cell(r, c.id),
            version: cell(r, c.version),
            source: cell(r, c.source),
            match_hint: cell(r, c.hint),
        })
        .filter(|p| looks_like_id(&p.id))
        .collect()
}

pub fn parse_list(raw: &str) -> Vec<InstalledPackage> {
    parse_tables(raw).first().map(to_installed).unwrap_or_default()
}

pub fn parse_upgrades(raw: &str) -> UpgradeList {
    let mut out = UpgradeList::default();
    for (i, table) in parse_tables(raw).iter().enumerate() {
        let explicit = i > 0 || table.preamble.to_lowercase().contains("explicit");
        let items = to_installed(table);
        if explicit {
            out.explicit.extend(items);
        } else {
            out.upgrades.extend(items);
        }
    }
    out
}

/// Parses `winget show --versions`.
pub fn parse_versions(raw: &str) -> Vec<String> {
    parse_tables(raw)
        .first()
        .map(|t| t.rows.iter().filter_map(|r| r.first()).filter(|v| !v.is_empty()).cloned().collect())
        .unwrap_or_default()
}

fn found_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"Found\s+(.+?)\s+\[([^\]]+)\]\s*$").unwrap())
}

fn split_kv(text: &str) -> Option<(&str, &str)> {
    let idx = text.find(':')?;
    let key = text[..idx].trim();
    if key.is_empty() || key.contains("//") {
        return None;
    }
    Some((key, text[idx + 1..].trim()))
}

#[derive(PartialEq)]
enum Section {
    None,
    Tags,
    ReleaseNotes,
    Description,
    Documentation,
    Installer,
    Other,
}

fn append_text(target: &mut String, line: &str) {
    if !target.is_empty() {
        target.push('\n');
    }
    target.push_str(line);
}

/// Parses `winget show` output. Returns `None` when winget found no package.
pub fn parse_show(raw: &str) -> Option<PackageDetails> {
    let lines = clean_lines(raw);
    let mut d = PackageDetails::default();
    let mut started = false;
    let mut sec = Section::None;

    for line in &lines {
        if !started {
            if let Some(c) = found_re().captures(line) {
                d.name = c[1].to_string();
                d.id = c[2].to_string();
                started = true;
            }
            continue;
        }
        if line.trim().is_empty() {
            if matches!(sec, Section::ReleaseNotes | Section::Description) {
                // keep paragraph breaks inside long text
                if !d.release_notes.is_empty() && sec == Section::ReleaseNotes {
                    d.release_notes.push('\n');
                } else if !d.description.is_empty() && sec == Section::Description {
                    d.description.push('\n');
                }
            }
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        let text = line.trim();

        if indent == 0 {
            let Some((key, value)) = split_kv(text) else { continue };
            let k = key.to_lowercase();
            if value.is_empty() {
                sec = match k.as_str() {
                    "tags" => Section::Tags,
                    "release notes" => Section::ReleaseNotes,
                    "description" => Section::Description,
                    "documentation" => Section::Documentation,
                    "installer" => {
                        d.installers.push(InstallerInfo::default());
                        Section::Installer
                    }
                    _ => Section::Other,
                };
                continue;
            }
            sec = Section::None;
            let v = value.to_string();
            match k.as_str() {
                "version" => d.version = v,
                "publisher" => d.publisher = v,
                "publisher url" => d.publisher_url = v,
                "publisher support url" => d.publisher_support_url = v,
                "author" => d.author = v,
                "moniker" => d.moniker = v,
                "description" => d.description = v,
                "homepage" => d.homepage = v,
                "license" => d.license = v,
                "license url" => d.license_url = v,
                "privacy url" => d.privacy_url = v,
                "copyright" => d.copyright = v,
                "copyright url" => d.copyright_url = v,
                "release notes" => d.release_notes = v,
                "release notes url" => d.release_notes_url = v,
                _ => {}
            }
        } else {
            match sec {
                Section::Tags => d.tags.push(text.to_string()),
                Section::ReleaseNotes => append_text(&mut d.release_notes, text),
                Section::Description => append_text(&mut d.description, text),
                Section::Documentation => {
                    if let Some((k, v)) = split_kv(text) {
                        match k.to_lowercase().as_str() {
                            "label" => d.documentation.push(Documentation { label: v.to_string(), url: String::new() }),
                            "url" => {
                                if let Some(last) = d.documentation.last_mut() {
                                    last.url = v.to_string();
                                } else {
                                    d.documentation.push(Documentation { label: String::new(), url: v.to_string() });
                                }
                            }
                            _ => {}
                        }
                    }
                }
                Section::Installer => {
                    if let (Some((k, v)), Some(inst)) = (split_kv(text), d.installers.last_mut()) {
                        let v = v.to_string();
                        match k.to_lowercase().as_str() {
                            "type" | "installer type" => inst.installer_type = v,
                            "architecture" | "installer architecture" => inst.architecture = v,
                            "locale" | "installer locale" => inst.locale = v,
                            "scope" | "installer scope" => inst.scope = v,
                            "download url" | "installer url" => inst.download_url = v,
                            "sha256" | "installer sha256" => inst.sha256 = v,
                            "release date" => inst.release_date = v,
                            "store product id" => inst.store_product_id = v,
                            "offline distribution supported" => inst.offline_distribution = v,
                            _ => {}
                        }
                    }
                }
                Section::None | Section::Other => {}
            }
        }
    }
    started.then_some(d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use unicode_width::UnicodeWidthStr;

    /// Pads to a display width, the way winget pads table cells.
    fn pad(s: &str, w: usize) -> String {
        let cur = UnicodeWidthStr::width(s);
        format!("{}{}", s, " ".repeat(w.saturating_sub(cur)))
    }

    fn row(cells: &[(&str, usize)]) -> String {
        cells.iter().map(|(s, w)| pad(s, *w)).collect::<String>().trim_end().to_string()
    }

    #[test]
    fn strip_ansi_removes_osc_title_sequences() {
        assert_eq!(strip_ansi("\x1b]0;winget.exe\x07\x1b[2Joutput"), "output");
    }

    #[test]
    fn search_with_match_and_source() {
        let widths = [30usize, 30, 12, 14, 8];
        let mut out = String::new();
        out += "\r-\r\\\r|\r   \r"; // spinner noise before the table
        out += &row(&[("Name", 30), ("Id", 30), ("Version", 12), ("Match", 14), ("Source", 8)]);
        out += "\r\n";
        out += &"-".repeat(widths.iter().sum::<usize>());
        out += "\r\n";
        out += &row(&[("Visual Studio Code", 30), ("Microsoft.VisualStudioCode", 30), ("1.95.3", 12), ("", 14), ("winget", 8)]);
        out += "\r\n";
        out += &row(&[("Notepad++", 30), ("Notepad++.Notepad++", 30), ("8.7.1", 12), ("Tag: editor", 14), ("winget", 8)]);
        out += "\r\n";
        let r = parse_search(&out);
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].name, "Visual Studio Code");
        assert_eq!(r[0].id, "Microsoft.VisualStudioCode");
        assert_eq!(r[0].version, "1.95.3");
        assert_eq!(r[0].match_hint, "");
        assert_eq!(r[1].match_hint, "Tag: editor");
        assert_eq!(r[1].source, "winget");
    }

    #[test]
    fn search_without_match_column() {
        let out = format!(
            "{}\n{}\n{}\n",
            row(&[("Name", 20), ("Id", 20), ("Version", 10), ("Source", 8)]),
            "-".repeat(58),
            row(&[("7-Zip", 20), ("7zip.7zip", 20), ("24.09", 10), ("winget", 8)]),
        );
        let r = parse_search(&out);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].source, "winget");
        assert_eq!(r[0].match_hint, "");
    }

    #[test]
    fn list_with_cjk_names_stays_aligned() {
        let out = format!(
            "{}\n{}\n{}\n{}\n{}\n",
            row(&[("Name", 24), ("Id", 28), ("Version", 12), ("Available", 12), ("Source", 8)]),
            "-".repeat(84),
            row(&[("微信", 24), ("Tencent.WeChat", 28), ("3.9.12", 12), ("3.9.20", 12), ("winget", 8)]),
            row(&[("Git", 24), ("Git.Git", 28), ("2.47.0", 12), ("", 12), ("winget", 8)]),
            row(&[("Legacy Tool", 24), ("ARP\\Machine\\X64\\LegacyTool", 28), ("1.0", 12), ("", 12), ("", 8)]),
        );
        let r = parse_list(&out);
        assert_eq!(r.len(), 3);
        assert_eq!(r[0].name, "微信");
        assert_eq!(r[0].id, "Tencent.WeChat");
        assert_eq!(r[0].available, "3.9.20");
        assert_eq!(r[0].source, "winget");
        assert_eq!(r[1].available, "");
        assert_eq!(r[2].id, "ARP\\Machine\\X64\\LegacyTool");
        assert_eq!(r[2].source, "");
    }

    #[test]
    fn list_without_available_column() {
        let out = format!(
            "{}\n{}\n{}\n",
            row(&[("Name", 20), ("Id", 20), ("Version", 10), ("Source", 8)]),
            "-".repeat(58),
            row(&[("Git", 20), ("Git.Git", 20), ("2.47.0", 10), ("winget", 8)]),
        );
        let r = parse_list(&out);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].available, "");
        assert_eq!(r[0].source, "winget");
    }

    #[test]
    fn upgrades_split_into_two_tables_and_skip_footers() {
        let h = row(&[("Name", 20), ("Id", 22), ("Version", 10), ("Available", 10), ("Source", 8)]);
        let sep = "-".repeat(70);
        let out = format!(
            "{h}\r\n{sep}\r\n{}\r\n{}\r\n2 upgrades available.\r\n\r\nThe following packages have an upgrade available, but require explicit targeting for upgrade:\r\n{h}\r\n{sep}\r\n{}\r\n1 upgrades available.\r\n",
            row(&[("Git", 20), ("Git.Git", 22), ("2.46.0", 10), ("2.47.0", 10), ("winget", 8)]),
            row(&[("VLC media player", 20), ("VideoLAN.VLC", 22), ("3.0.20", 10), ("3.0.21", 10), ("winget", 8)]),
            row(&[("Some Pinned App", 20), ("Vendor.Pinned", 22), ("Unknown", 10), ("5.0", 10), ("winget", 8)]),
        );
        let u = parse_upgrades(&out);
        assert_eq!(u.upgrades.len(), 2, "{:?}", u);
        assert_eq!(u.upgrades[1].id, "VideoLAN.VLC");
        assert_eq!(u.explicit.len(), 1);
        assert_eq!(u.explicit[0].id, "Vendor.Pinned");
        assert_eq!(u.explicit[0].version, "Unknown");
    }

    #[test]
    fn no_results_yields_empty() {
        assert!(parse_search("No package found matching input criteria.\r\n").is_empty());
        assert!(parse_list("").is_empty());
        assert_eq!(parse_upgrades("No installed package found matching input criteria."), UpgradeList::default());
    }

    #[test]
    fn localized_headers_fall_back_to_positions() {
        let out = format!(
            "{}\n{}\n{}\n",
            row(&[("Nom", 20), ("ID", 20), ("Version", 10), ("Disponible", 12), ("Source", 8)]),
            "-".repeat(70),
            row(&[("Git", 20), ("Git.Git", 20), ("2.46.0", 10), ("2.47.0", 12), ("winget", 8)]),
        );
        let r = parse_list(&out);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].id, "Git.Git");
        assert_eq!(r[0].available, "2.47.0");
    }

    #[test]
    fn versions_table() {
        let out = "Found Git [Git.Git]\r\nVersion\r\n-------\r\n2.47.0\r\n2.46.2\r\n2.46.0\r\n";
        assert_eq!(parse_versions(out), vec!["2.47.0", "2.46.2", "2.46.0"]);
    }

    const SHOW: &str = "\
Found Visual Studio Code [Microsoft.VisualStudioCode]
Version: 1.95.3
Publisher: Microsoft Corporation
Publisher Url: https://www.microsoft.com
Publisher Support Url: https://code.visualstudio.com/docs
Author: Microsoft Corporation
Moniker: vscode
Description: Build and debug modern web and cloud applications.
Homepage: https://code.visualstudio.com/
License: Microsoft Software License
License Url: https://code.visualstudio.com/license
Privacy Url: https://privacy.microsoft.com/privacystatement
Copyright: Copyright (c) Microsoft Corporation. All rights reserved.
Release Notes:
  Fixed a crash on startup.

  Improved search performance.
Release Notes Url: https://code.visualstudio.com/updates
Tags:
  editor
  ide
  typescript
Documentation:
  Label: Docs
  Url: https://code.visualstudio.com/docs
Installer:
  Type: inno
  Locale: en-US
  Download Url: https://update.code.visualstudio.com/1.95.3/win32-x64-user/stable
  SHA256: 0a1b2c
  Release Date: 2024-11-14
";

    #[test]
    fn show_full_manifest() {
        let d = parse_show(&SHOW.replace('\n', "\r\n")).unwrap();
        assert_eq!(d.id, "Microsoft.VisualStudioCode");
        assert_eq!(d.name, "Visual Studio Code");
        assert_eq!(d.version, "1.95.3");
        assert_eq!(d.publisher, "Microsoft Corporation");
        assert_eq!(d.homepage, "https://code.visualstudio.com/");
        assert_eq!(d.moniker, "vscode");
        assert_eq!(d.license_url, "https://code.visualstudio.com/license");
        assert_eq!(d.tags, vec!["editor", "ide", "typescript"]);
        assert_eq!(d.release_notes, "Fixed a crash on startup.\n\nImproved search performance.");
        assert_eq!(d.release_notes_url, "https://code.visualstudio.com/updates");
        assert_eq!(d.documentation.len(), 1);
        assert_eq!(d.documentation[0].label, "Docs");
        assert_eq!(d.installers.len(), 1);
        let i = &d.installers[0];
        assert_eq!(i.installer_type, "inno");
        assert_eq!(i.download_url, "https://update.code.visualstudio.com/1.95.3/win32-x64-user/stable");
        assert_eq!(i.sha256, "0a1b2c");
        assert_eq!(i.release_date, "2024-11-14");
    }

    #[test]
    fn show_multiline_description() {
        let raw = "Found Foo [Vendor.Foo]\nVersion: 1.0\nDescription:\n  First line.\n  Second line.\nHomepage: https://foo.example\n";
        let d = parse_show(raw).unwrap();
        assert_eq!(d.description, "First line.\nSecond line.");
        assert_eq!(d.homepage, "https://foo.example");
    }

    #[test]
    fn show_not_found() {
        assert!(parse_show("No package found matching input criteria.").is_none());
    }
}

