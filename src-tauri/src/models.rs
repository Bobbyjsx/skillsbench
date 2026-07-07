use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub kind: String, // "cli" | "ide" | "shared"
    pub detected: bool,
    pub discovering: bool,
    pub version: Option<String>,
    pub binary: bool,
    pub global_dirs: Vec<String>,
    pub project_dir_names: Vec<String>,
    pub skill_count: i64,
    pub project_skill_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub path: String,
    pub name: String,
    pub skill_count: i64,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Counts {
    pub skills: i64,
    pub instances: i64,
    pub updates: i64,
    pub modified: i64,
    pub broken: i64,
    pub invalid: i64,
    pub untracked: i64,
    pub duplicates: i64,
    pub groups: i64,
    pub projects: i64,
    pub agents: i64,
    pub warnings: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSummary {
    pub id: String, // logical id: content hash of the primary installation
    pub path: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub status: String,
    pub scope: String,
    pub project_path: Option<String>,
    pub agent_ids: Vec<String>,
    pub duplicate_count: i64,
    pub file_count: i64,
    pub mtime_ms: i64,
    pub groups: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDetail {
    pub summary: SkillSummary,
    pub locations: Vec<InstallLocation>,
    pub files: Vec<FileEntry>,
    pub security: SecurityReport,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallLocation {
    pub agent_id: String,
    pub path: String,
    pub scope: String,
    pub project_path: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub kind: String, // "dir" | "file"
    pub size: i64,
    pub depth: u8,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecurityReport {
    pub risk: String, // "none" | "low" | "medium" | "high"
    pub checked_files: i64,
    pub scripts: i64,
    pub networks: i64,
    pub credentials: i64,
    pub destructive: i64,
    pub findings: Vec<Finding>,
    pub header: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub rule: String,
    pub severity: String,
    pub file: String,
    pub line: i64,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupRow {
    pub id: i64,
    pub name: String,
    pub sort: i64,
    pub skill_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStatus {
    pub running: bool,
    pub phase: String,
    pub found: i64,
    pub step: i64,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    pub sidebar: String, // "full" | "collapsed"
    pub inspector_open: bool,
    pub inspector_pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String, // "system" | "light" | "dark"
    pub first_launch_done: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            first_launch_done: false,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInfo {
    pub available: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub agents: Vec<AgentInfo>,
    pub projects: Vec<ProjectInfo>,
    pub counts: Counts,
    pub settings: AppSettings,
    pub ui: UiState,
    pub cli: CliInfo,
    pub home: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListSkillsReq {
    pub query: Option<String>,
    pub tab: Option<String>,
    pub agent: Option<String>,
    pub scope: Option<String>,
    pub group: Option<String>,
    pub sort: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillReq {
    pub name: String,
    pub description: String,
    pub scope: String, // "global" | "project"
    pub agents: Vec<String>,
    pub project_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallReq {
    pub source_path: String,
    pub agents: Vec<String>,
    pub scope: String, // "global" | "project"
    pub project_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallReq {
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupReq {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignReq {
    pub group_name: String,
    pub skill_path: String,
}