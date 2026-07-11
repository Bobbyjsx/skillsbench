import { create } from "zustand";
import type { SkillDetail, SkillSummary } from "../types/api";
import { api } from "../api/client";

export type LibraryTab = "all" | "installed" | "updates" | "untracked" | "issues";

interface SkillsState {
  items: SkillSummary[];
  total: number;
  loaded: boolean;
  loadingMore: boolean;
  query: string;
  tab: LibraryTab;
  agent: string | null;
  scope: "all" | "global" | "project" | null;
  group: string | null;
  sort: "updated" | "name" | "installed";
  detail: SkillDetail | null;
  detailLoading: boolean;

  setQuery: (q: string) => void;
  setTab: (t: LibraryTab) => void;
  setAgent: (a: string | null) => void;
  setScope: (s: "all" | "global" | "project" | null) => void;
  setGroup: (g: string | null) => void;
  setSort: (s: "updated" | "name" | "installed") => void;
  reset: () => void;
  loadFirstPage: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  openDetail: (path: string, cached?: SkillSummary) => void;
  closeDetail: () => void;
  dropItem: (path: string) => void;
}

export const PAGE = 500;

export const useSkills = create<SkillsState>((set, get) => ({
  items: [],
  total: 0,
  loaded: false,
  loadingMore: false,
  query: "",
  tab: "all",
  agent: null,
  scope: null,
  group: null,
  sort: "updated",
  detail: null,
  detailLoading: false,

  setQuery: (q) => {
    set({ query: q });
    get().loadFirstPage();
  },
  setTab: (t) => {
    set({ tab: t });
    get().loadFirstPage();
  },
  setAgent: (a) => {
    set({ agent: a });
    get().loadFirstPage();
  },
  setScope: (s) => {
    set({ scope: s });
    get().loadFirstPage();
  },
  setGroup: (g) => {
    set({ group: g });
    get().loadFirstPage();
  },
  setSort: (s) => {
    set({ sort: s });
    get().loadFirstPage();
  },
  reset: () => {
    set({ items: [], total: 0, query: "", tab: "all", agent: null, scope: null, group: null });
    get().loadFirstPage();
  },

  loadFirstPage: async () => {
    const { query, tab, agent, scope, group, sort } = get();
    try {
      const items = await api.listSkills({
        query: query || undefined,
        tab,
        agent: agent ?? undefined,
        scope: scope === "all" ? undefined : (scope ?? undefined),
        group: group ?? undefined,
        sort,
        limit: PAGE,
        offset: 0,
      });
      set({ items, total: items.length < PAGE ? items.length : items.length, loaded: true });
    } catch (e) {
      console.error("list failed", e);
      set({ items: [], loaded: true });
    }
  },

  loadMore: async () => {
    if (get().loadingMore) return;
    const { query, tab, agent, scope, group, sort, items } = get();
    set({ loadingMore: true });
    try {
      const more = await api.listSkills({
        query: query || undefined,
        tab,
        agent: agent ?? undefined,
        scope: scope === "all" ? undefined : (scope ?? undefined),
        group: group ?? undefined,
        sort,
        limit: PAGE,
        offset: items.length,
      });
      const seen = new Set(items.map((i) => i.id));
      const merged = [...items, ...more.filter((m) => !seen.has(m.id))];
      set({ items: merged, total: merged.length });
    } catch {
      /* ignore */
    } finally {
      set({ loadingMore: false });
    }
  },

  refresh: async () => {
    await get().loadFirstPage();
  },

  openDetail: (path, cached) => {
    set({
      detailLoading: true,
      detail: cached
        ? {
            summary: cached,
            locations: [],
            files: [],
            security: {
              risk: "none",
              checkedFiles: 0,
              scripts: 0,
              networks: 0,
              credentials: 0,
              destructive: 0,
              findings: [],
              header: "",
            },
          }
        : null,
    });
    api
      .skillDetail(path)
      .then((detail) => {
        api.logLine(
          `detail for ${path}: summary=${detail?.summary ? "yes" : "NO"} name=${detail?.summary?.name ?? "?"} locs=${detail?.locations?.length ?? "?"}`,
        );
        set({ detail, detailLoading: false });
      })
      .catch((e) => {
        api.logLine(`detail FAILED for ${path}: ${String(e)}`);
        set({ detail: null, detailLoading: false });
      });
  },

  closeDetail: () => set({ detail: null }),

  dropItem: (path) => {
    set({ items: get().items.filter((i) => i.path !== path), total: Math.max(0, get().total - 1) });
  },
}));
