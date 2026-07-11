import { create } from "zustand";
import type { AgentInfo, Counts, ProjectInfo, Snapshot, UiState } from "../types/api";
import { api } from "../api/client";

export type Screen =
  "overview" | "skills" | "marketplace" | "groups" | "agents" | "projects" | "settings" | "editor";

interface AppState {
  ready: boolean;
  welcomeShown: boolean;
  screen: Screen;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  inspectorOpen: boolean;
  inspectorPinned: boolean;
  inspectorPath: string | null;
  paletteOpen: boolean;
  paletteMode: "all" | "skills";
  editorTarget: { path: string; file: string } | null;
  scanRunning: boolean;
  lastScan: Snapshot["counts"] | null;

  agents: AgentInfo[];
  projects: ProjectInfo[];
  counts: Counts;
  settings: Snapshot["settings"];
  cli: Snapshot["cli"];
  home: string;

  load: () => Promise<void>;
  refreshCounts: () => Promise<void>;
  refreshAgents: () => Promise<void>;
  setTheme: (t: "dark" | "light" | "system") => void;
  setScreen: (s: Screen) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setMobileSidebar: (open: boolean) => void;
  setSidebar: (c: boolean) => void;
  setInspector: (path: string | null, opts?: { pin?: boolean }) => void;
  toggleInspectorPin: () => void;
  setPalette: (open: boolean, mode?: "all" | "skills") => void;
  openEditor: (path: string, file: string) => void;
  closeEditor: () => void;
  setScanRunning: (r: boolean) => void;
  scanNow: () => Promise<void>;
  persistUi: (ui?: Partial<UiState>) => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  welcomeShown: false,
  screen: "overview",
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  inspectorOpen: false,
  inspectorPinned: false,
  inspectorPath: null,
  paletteOpen: false,
  paletteMode: "all",
  editorTarget: null,
  scanRunning: false,
  lastScan: null,

  agents: [],
  projects: [],
  counts: {
    skills: 0,
    instances: 0,
    updates: 0,
    modified: 0,
    broken: 0,
    invalid: 0,
    untracked: 0,
    duplicates: 0,
    groups: 0,
    projects: 0,
    agents: 0,
    warnings: 0,
  },
  settings: { theme: "dark", firstLaunchDone: false },
  cli: { available: false, version: null },
  home: "",

  load: async () => {
    try {
      const snap = await api.snapshot();
      set({
        agents: snap.agents,
        projects: snap.projects,
        counts: snap.counts,
        settings: snap.settings,
        cli: snap.cli,
        home: snap.home,
        sidebarCollapsed: snap.ui.sidebar === "collapsed",
        inspectorOpen: snap.ui.inspectorOpen,
        inspectorPinned: snap.ui.inspectorPinned,
        welcomeShown: snap.settings.firstLaunchDone,
        ready: true,
      });
    } catch (e) {
      console.error("snapshot failed", e);
    }
  },

  refreshCounts: async () => {
    try {
      const c = await api.counts();
      set({ counts: c });
    } catch {
      /* keep last */
    }
  },

  refreshAgents: async () => {
    try {
      const agents = await api.redetectAgents();
      set({ agents });
    } catch {
      /* keep last */
    }
  },

  setScreen: (s) => {
    if (get().screen !== s) set({ screen: s, inspectorPath: null, inspectorOpen: false });
  },

  setTheme: (t) => {
    set({ settings: { ...get().settings, theme: t } });
    api.setSetting("theme", t);
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next });
    get().persistUi({ sidebar: next ? "collapsed" : "full" });
  },

  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  setMobileSidebar: (open) => set({ mobileSidebarOpen: open }),

  setSidebar: (c) => {
    set({ sidebarCollapsed: c });
    get().persistUi({ sidebar: c ? "collapsed" : "full" });
  },

  setInspector: (path, opts) => {
    set({
      inspectorPath: path,
      inspectorOpen: path !== null,
      inspectorPinned: opts?.pin ?? get().inspectorPinned,
    });
    get().persistUi({ inspectorOpen: path !== null, inspectorPinned: get().inspectorPinned });
  },

  toggleInspectorPin: () => {
    set({ inspectorPinned: !get().inspectorPinned });
    get().persistUi({ inspectorPinned: get().inspectorPinned });
  },

  setPalette: (open, mode = "all") =>
    set({ paletteOpen: open, paletteMode: open ? mode : get().paletteMode }),

  openEditor: (path, file) => set({ screen: "editor", editorTarget: { path, file } }),

  closeEditor: () => set({ screen: "skills", editorTarget: null }),

  setScanRunning: (r) => set({ scanRunning: r }),

  scanNow: async () => {
    await api.scanNow();
  },

  persistUi: async (ui) => {
    const g = get();
    api.setUi({
      sidebar: ui?.sidebar ?? (g.sidebarCollapsed ? "collapsed" : "full"),
      inspectorOpen: ui?.inspectorOpen ?? g.inspectorOpen,
      inspectorPinned: ui?.inspectorPinned ?? g.inspectorPinned,
    });
  },
}));
