import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Blocks,
  Compass,
  Layers,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp } from "../../stores/app";
import { useSkills } from "../../stores/skills";
import { api } from "../../api/client";
import type { SkillSummary } from "../../types/api";
import { cn } from "../../lib/cn";
import { mod } from "../../lib/keys";
import { Kbd } from "../ui/Misc";
import { SkillGlyph } from "../skills/SkillGlyph";
import { StatusDot } from "../ui/Badge";
import { toast } from "../../stores/toasts";

interface PaletteAction {
  group: string;
  label: string;
  kbd?: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette() {
  const app = useApp();
  const { openDetail } = useSkills();
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const timer = useRef<number | null>(null);

  const open = app.paletteOpen;
  const skillsMode = app.paletteMode === "skills";

  const actions: PaletteAction[] = useMemo(() => {
    const nav = (items: { label: string; icon: LucideIcon; go: () => void }[]) =>
      items.map((i) => ({ group: "Go to", label: i.label, icon: i.icon, run: i.go }));

    const acts: PaletteAction[] = [
      ...nav([
        { label: "Skills", icon: Blocks, go: () => app.setScreen("skills") },
        { label: "Overview", icon: Search, go: () => app.setScreen("overview") },
        { label: "Discover marketplace", icon: Compass, go: () => app.setScreen("marketplace") },
        { label: "Groups", icon: Layers, go: () => app.setScreen("groups") },
        { label: "Agents", icon: Users, go: () => app.setScreen("agents") },
        { label: "Settings", icon: Settings, go: () => app.setScreen("settings") },
      ]),
      {
        group: "Actions",
        label: "Create skill",
        kbd: `${mod}N`,
        icon: PlusCircle,
        run: () => {
          app.setPalette(false);
          // creation is opened from the Skills screen toolbar; switch there
          app.setScreen("skills");
          window.setTimeout(
            () => window.dispatchEvent(new CustomEvent("skillbench:new-skill")),
            60,
          );
        },
      },
      {
        group: "Actions",
        label: "Scan for changes",
        icon: RefreshCw,
        run: async () => {
          app.setPalette(false);
          toast.info("Scanning for changes…");
          await api.scanNow();
        },
      },
    ];

    const q = query.trim().toLowerCase();
    if (!skillsMode && q) {
      const matched = acts.filter(
        (a) => a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q),
      );
      const skillMatches = skills.map<PaletteAction>((s) => ({
        group: "Skills",
        label: s.name,
        icon: Blocks,
        run: () => {
          app.setInspector(s.path);
          app.setScreen("skills");
          app.setPalette(false);
          openDetail(s.path, s);
        },
      }));
      return [...matched, ...skillMatches];
    }
    return acts;
  }, [app, query, skills, skillsMode, openDetail]);

  const allItems = useMemo(() => {
    const skillItems = skills.map<{ kind: "skill"; skill: SkillSummary }>((s) => ({
      kind: "skill",
      skill: s,
    }));
    const actionItems = actions.map<{ kind: "action"; action: PaletteAction }>((a) => ({
      kind: "action",
      action: a,
    }));
    return skillsMode ? [...skillItems, ...actionItems] : [...actionItems, ...skillItems];
  }, [skills, actions, skillsMode]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const g = item.kind === "skill" ? "Skills" : item.action.group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    return [...map.entries()];
  }, [allItems]);

  // ---- search debounce ----------------
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!open) return;
    timer.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { agent, scope, group, text } = parseFilters(query);
        const res = await api.listSkills({
          query: text || undefined,
          agent: agent ?? undefined,
          scope: scope ?? undefined,
          group: group ?? undefined,
          sort: "updated",
          limit: 12,
        });
        setSkills(res);
      } catch {
        setSkills([]);
      } finally {
        setSearching(false);
      }
    }, 120);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query, open]);

  // ---- reset on open -------------------
  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  if (!open) return null;

  const groupsOut = groups.filter(([, items]) => items.length > 0);
  const total = groupsOut.reduce((n, [, items]) => n + items.length, 0);

  const move = (delta: number) => setIndex((i) => (i + delta + total) % total);
  const run = () => {
    let n = 0;
    for (const [, items] of groupsOut) {
      for (const item of items) {
        if (n === index) {
          if (item.kind === "action") {
            app.setPalette(false);
            item.action.run();
          } else {
            app.setInspector(item.skill.path);
            app.setScreen("skills");
            app.setPalette(false);
            openDetail(item.skill.path, item.skill);
          }
          return;
        }
        n++;
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) app.setPalette(false);
      }}
    >
      <div className="absolute inset-0 bg-black/45 animate-[fade-in_120ms_var(--sb-ease)]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative flex w-[600px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-[12px] border border-border-strong bg-surface shadow-[var(--shadow-pop)] animate-[palette-in_160ms_var(--sb-ease)]"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
          <Search className="size-4 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                move(1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                move(-1);
              } else if (e.key === "Enter") {
                e.preventDefault();
                run();
              } else if (e.key === "Escape") {
                app.setPalette(false);
              }
            }}
            placeholder={
              skillsMode
                ? "Search skills…  (agent:claude scope:global …)"
                : "Search or run a command…"
            }
            className="flex-1 bg-transparent text-lg text-text placeholder:text-faint focus:outline-none"
            aria-label="Search"
          />
          {searching && (
            <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-border-strong border-t-accent" />
          )}
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5" role="listbox">
          {groupsOut.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted">
              No matches for “{query}”. Try agent:claude, scope:global or status:modified.
            </div>
          )}
          {groupsOut.map(([group, items], gi) => (
            <div key={group} className="mb-1 last:mb-0">
              <div className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
                {group}
              </div>
              {items.map((item, ii) => {
                const idx = groupsOut.slice(0, gi).reduce((acc, [, it]) => acc + it.length, 0) + ii;
                const active = idx === index;
                return item.kind === "action" ? (
                  <button
                    key={`a-${item.action.label}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setIndex(idx)}
                    onClick={run}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-sm transition-colors duration-100",
                      active ? "bg-active text-text" : "text-muted",
                    )}
                  >
                    <item.action.icon
                      className={cn("size-3.5 shrink-0", active ? "text-text" : "text-faint")}
                      strokeWidth={1.75}
                    />
                    <span className="flex-1 text-left">{item.action.label}</span>
                    {item.action.kbd && <Kbd>{item.action.kbd}</Kbd>}
                    <ArrowRight
                      className={cn(
                        "size-3 transition-opacity duration-100",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                ) : (
                  <button
                    key={`s-${item.skill.id}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setIndex(idx)}
                    onClick={run}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-sm transition-colors duration-100",
                      active ? "bg-active text-text" : "text-muted",
                    )}
                  >
                    <SkillGlyph
                      name={item.skill.name}
                      description={item.skill.description}
                      size="sm"
                    />
                    <span className="flex-1 truncate text-left">{item.skill.name}</span>
                    <StatusDot status={item.skill.status} />
                    {item.skill.scope === "project" && (
                      <span className="text-2xs text-faint">project</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3.5 py-2 text-2xs text-faint">
          <span className="flex items-center gap-1">
            <Kbd>↑↓</Kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> Open
          </span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd> Close
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>{mod}K</Kbd> Toggle
          </span>
        </div>
      </div>
      <style>{`
        @keyframes palette-in { from { opacity: 0; transform: translateY(-8px) scale(0.98) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}

/** Extract structured filters ("agent:claude scope:global status:update") from a query. */
function parseFilters(q: string): {
  agent?: string;
  scope?: string;
  group?: string;
  text?: string;
} {
  const tokens = q.split(/\s+/).filter(Boolean);
  let agent: string | undefined;
  let scope: string | undefined;
  let group: string | undefined;
  const rest: string[] = [];
  for (const t of tokens) {
    if (t.startsWith("agent:")) agent = t.slice(6);
    else if (t.startsWith("scope:")) scope = t.slice(6);
    else if (t.startsWith("status:")) {
      rest.push(t.slice(7)); // folded into free text; FTS matches status names loosely
    } else if (t.startsWith("group:")) group = t.slice(6);
    else rest.push(t);
  }
  return { agent, scope, group, text: rest.join(" ") };
}
