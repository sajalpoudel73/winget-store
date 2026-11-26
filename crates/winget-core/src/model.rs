use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageSummary {
    pub name: String,
    pub id: String,
    pub version: String,
    pub source: String,
    /// Why the package matched the query (e.g. "Tag: editor"), when winget says so.
    pub match_hint: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPackage {
    pub name: String,
    pub id: String,
    pub version: String,
    /// Newer version available, empty when up to date.
    pub available: String,
    /// "winget", "msstore", or empty for apps winget cannot map to a source.
    pub source: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpgradeList {
    /// Packages winget can upgrade directly.
    pub upgrades: Vec<InstalledPackage>,
    /// Packages winget lists separately because they are pinned or have an unknown version.
    pub explicit: Vec<InstalledPackage>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Documentation {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallerInfo {
    pub installer_type: String,
    pub architecture: String,
    pub locale: String,
    pub scope: String,
    pub download_url: String,
    pub sha256: String,
    pub release_date: String,
    pub store_product_id: String,
    pub offline_distribution: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageDetails {
    pub id: String,
    pub name: String,
    pub version: String,
    pub publisher: String,
    pub publisher_url: String,
    pub publisher_support_url: String,
    pub author: String,
    pub moniker: String,
    pub description: String,
    pub homepage: String,
    pub license: String,
    pub license_url: String,
    pub privacy_url: String,
    pub copyright: String,
    pub copyright_url: String,
    pub release_notes: String,
    pub release_notes_url: String,
    pub tags: Vec<String>,
    pub documentation: Vec<Documentation>,
    pub installers: Vec<InstallerInfo>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// 0.0..=1.0 when winget reported a measurable amount.
    pub fraction: Option<f32>,
    pub label: String,
}
