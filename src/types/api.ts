// Mirrors the Rust models — keep field names (camelCase) in sync with `models.rs`.

export interface AgentInfo {
  id: string;
  name: string;
  kind: "cli" | "ide" | "shared";
  detected: boolean;
  discovering: boolean;
  version: string | null;
  binary: boolean;
  globalDirs: string[];
  projectDirNames: string[];
  skillCount: number;
  projectSkillCount: number;
}

export interface ProjectInfo {
  path: string;
  name: string;
  skillCount: number;
}

export interface Counts {
  skills: number;
  instances: number;
  updates: number;
  modified: number;
  broken: number;
  invalid: number;
  untracked: number;
  duplicates: number;
  groups: number;
  projects: number;
  agents: number;
  warnings: number;
}

export type SkillStatus = "ok" | "update" | "modified" | "broken" | "invalid" | "untracked";

export interface SkillSummary {
  id: string; // content hash
  path: string;
  name: string;
  slug: string;
  description: string | null;
  author: string | null;
  version: string | null;
  status: SkillStatus;
  scope: "global" | "project";
  projectPath: string | null;
  agentIds: string[];
  duplicateCount: number;
  fileCount: number;
  mtimeMs: number;
  groups: string[];
}

export interface InstallLocation {
  agentId: string;
  path: string;
  scope: string;
  projectPath: string | null;
  status: string;
}

export interface FileEntry {
  name: string;
  path: string;
  kind: "dir" | "file";
  size: number;
  depth: number;
}

export interface Finding {
  rule: string;
  severity: "info" | "low" | "medium" | "high";
  file: string;
  line: number;
  detail: string;
}

export interface SecurityReport {
  risk: "none" | "low" | "medium" | "high";
  checkedFiles: number;
  scripts: number;
  networks: number;
  credentials: number;
  destructive: number;
  findings: Finding[];
  header: string;
}

export interface SkillDetail {
  summary: SkillSummary;
  locations: InstallLocation[];
  files: FileEntry[];
  security: SecurityReport;
}

export interface FileData {
  isText: boolean;
  content: string;
}

export interface GroupRow {
  id: number;
  name: string;
  sort: number;
  skillCount: number;
}

export interface UiState {
  sidebar: "full" | "collapsed";
  inspectorOpen: boolean;
  inspectorPinned: boolean;
}

export interface AppSettings {
  theme: "system" | "light" | "dark";
  firstLaunchDone: boolean;
}

export interface CliInfo {
  available: boolean;
  version: string | null;
}

export interface Snapshot {
  agents: AgentInfo[];
  projects: ProjectInfo[];
  counts: Counts;
  settings: AppSettings;
  ui: UiState;
  cli: CliInfo;
  home: string;
}

export interface ListSkillsReq {
  query?: string;
  tab?: string;
  agent?: string;
  scope?: string;
  group?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export interface CreateSkillReq {
  name: string;
  description: string;
  scope: "global" | "project";
  agents: string[];
  projectPath?: string;
}

export interface InstallReq {
  sourcePath: string;
  agents: string[];
  scope: "global" | "project";
  projectPath?: string;
}

export interface UninstallReq {
  paths: string[];
}

export interface ScanEvent {
  phase: string;
  found: number;
  total: number;
  outcome: {
    added: number;
    updated: number;
    modified: number;
    healed: number;
    broken: number;
    total: number;
  } | null;
}
export interface MarketSkill {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string;
  isOfficial: boolean;
}

export interface MarketCatalog {
  items: MarketSkill[];
  refreshedAtMs: number;
}
