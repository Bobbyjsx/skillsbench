import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AgentInfo,
  Counts,
  CreateSkillReq,
  GroupRow,
  InstallReq,
  ListSkillsReq,
  MarketCatalog,
  MarketSkill,
  ProjectInfo,
  ScanEvent,
  SkillDetail,
  SkillSummary,
  Snapshot,
  UiState,
  UninstallReq,
  FileData,
} from "../types/api";

export const api = {
  snapshot: () => invoke<Snapshot>("snapshot"),
  logLine: (msg: string) => invoke<void>("log_line", { msg }),
  listSkills: (req: ListSkillsReq) => invoke<SkillSummary[]>("list_skills", { req }),
  counts: () => invoke<Counts>("counts"),
  skillDetail: (path: string) => invoke<SkillDetail>("get_skill_detail", { path }),
  acknowledgeSkill: (path: string) => invoke<void>("acknowledge_skill", { path }),
  forgetSkill: (path: string) => invoke<void>("forget_skill", { path }),
  createSkill: (req: CreateSkillReq) => invoke<SkillDetail>("create_skill", { req }),
  readSkillFile: (skillPath: string, file: string) =>
    invoke<string>("read_skill_file", { skillPath, file }),
  readSkillFileData: (skillPath: string, file: string) =>
    invoke<FileData>("read_skill_file_data", { skillPath, file }),
  writeSkillFile: (skillPath: string, file: string, content: string) =>
    invoke<boolean>("write_skill_file", { skillPath, file, content }),
  installSkill: (req: InstallReq) => invoke<string[]>("install_skill", { req }),
  uninstallSkills: (req: UninstallReq) => invoke<string[]>("uninstall_skills", { req }),
  redetectAgents: () => invoke<AgentInfo[]>("redetect_agents"),
  addProjectRoot: (path: string) => invoke<ProjectInfo>("add_project_root", { path }),
  removeProjectRoot: (path: string) => invoke<void>("remove_project_root", { path }),
  groups: () => invoke<GroupRow[]>("list_groups"),
  createGroup: (name: string) => invoke<GroupRow>("create_group", { name }),
  renameGroup: (id: number, name: string) => invoke<void>("rename_group", { id, name }),
  deleteGroup: (id: number) => invoke<void>("delete_group", { id }),
  assignGroup: (groupName: string, skillPath: string) =>
    invoke<void>("assign_group", { req: { groupName, skillPath } }),
  unassignGroup: (groupName: string, skillPath: string) =>
    invoke<void>("unassign_group", { req: { groupName, skillPath } }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  setUi: (ui: UiState) => invoke<void>("set_ui", { ui }),
  scanNow: () => invoke<void>("scan_now"),
  marketSearch: (query: string, limit = 24) =>
    invoke<MarketSkill[]>("market_search", { query, limit }),
  marketCatalog: (force = false) => invoke<MarketCatalog>("market_catalog", { force }),
};

export type { UnlistenFn };

export async function listenToScan(cb: (e: ScanEvent) => void): Promise<UnlistenFn> {
  const un1 = await listen<ScanEvent>("scan:progress", (e) => cb(e.payload));
  const un2 = await listen<ScanEvent>("scan:done", (e) => cb(e.payload));
  return () => {
    un1();
    un2();
  };
}

export async function listenToSkillsChanged(cb: () => void): Promise<UnlistenFn> {
  return listen("skills:changed", () => cb());
}

export async function listenToErrors(cb: (msg: string) => void): Promise<UnlistenFn> {
  return listen<{ message: string }>("app:error", (e) => cb(e.payload.message));
}
