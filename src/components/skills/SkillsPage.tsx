import { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import { useApp } from "../../stores/app";
import { useSkills, type LibraryTab } from "../../stores/skills";
import { mod } from "../../lib/keys";
import { Kbd } from "../ui/Misc";
import { Segmented } from "../ui/Controls";
import { SkillList } from "../skills/SkillList";
import { Button } from "../ui/Button";

import { useShallow } from "zustand/react/shallow";

export function SkillsPage() {
  const counts = useApp((s) => s.counts);
  const agents = useApp((s) => s.agents);
  const skills = useSkills(
    useShallow((s) => ({
      query: s.query,
      setQuery: s.setQuery,
      tab: s.tab,
      setTab: s.setTab,
      scope: s.scope,
      setScope: s.setScope,
      agent: s.agent,
      setAgent: s.setAgent,
      loaded: s.loaded,
      loadFirstPage: s.loadFirstPage,
    })),
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const tabs: { value: LibraryTab; label: string; count?: number }[] = useMemo(() => {
    const c = counts;
    return [
      { value: "all", label: "All" },
      { value: "installed", label: "Installed" },
      { value: "updates", label: "Updates", count: c.updates },
      { value: "untracked", label: "Untracked", count: c.untracked },
      { value: "issues", label: "Issues", count: c.modified + c.broken },
    ];
  }, [counts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.metaKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!skills.loaded) skills.loadFirstPage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => window.dispatchEvent(new Event("skillbench:new-skill"));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 px-4 pb-2 pt-3">
        <div className="relative w-[300px]">
          <input
            ref={searchRef}
            value={skills.query}
            onChange={(e) => skills.setQuery(e.target.value)}
            placeholder="Search skills…"
            aria-label="Search skills"
            className="h-7 w-full rounded-[6px] border border-border bg-surface-2 pl-2.5 pr-8 text-sm text-text placeholder:text-faint transition-colors duration-120 hover:border-border-strong focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <Kbd className="absolute right-1.5 top-1/2 -translate-y-1/2">{mod}F</Kbd>
        </div>

        <Segmented value={skills.tab} onChange={(v) => skills.setTab(v)} options={tabs} />

        <div className="ml-auto flex items-center gap-2">
          <select
            value={skills.scope ?? "all"}
            onChange={(e) =>
              skills.setScope(e.target.value === "all" ? null : (e.target.value as never))
            }
            aria-label="Scope filter"
            className="h-7 rounded-[6px] border border-border bg-surface-2 px-2 text-sm text-muted transition-colors hover:border-border-strong focus:outline-none"
          >
            <option value="all">All scopes</option>
            <option value="global">Global</option>
            <option value="project">Project</option>
          </select>

          <select
            value={skills.agent ?? ""}
            onChange={(e) => skills.setAgent(e.target.value || null)}
            aria-label="Agent filter"
            className="h-7 rounded-[6px] border border-border bg-surface-2 px-2 text-sm text-muted transition-colors hover:border-border-strong focus:outline-none"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <Button variant="primary" size="sm" onClick={openCreate} data-create-skill>
            <Plus className="size-3.5" />
            New Skill
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <SkillList />
      </div>
    </div>
  );
}
