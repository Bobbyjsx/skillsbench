import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Compass, Plus, ShieldCheck } from "lucide-react";
import { useApp } from "../../stores/app";
import { api } from "../../api/client";
import type { SkillSummary } from "../../types/api";
import { timeAgo, pluralize } from "../../lib/format";
import { StatusDot } from "../ui/Badge";
import { SkillGlyph } from "../skills/SkillGlyph";
import { Button } from "../ui/Button";
import { useSkills } from "../../stores/skills";
import { detectedAgents } from "../../lib/agents";
import { cn } from "../../lib/cn";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function OverviewPage() {
  const app = useApp();
  const skills = useSkills();
  const [recent, setRecent] = useState<SkillSummary[]>([]);

  useEffect(() => {
    api
      .listSkills({ sort: "updated", limit: 7 })
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [app.counts.skills]);

  const heading = useMemo(() => greeting(), []);

  const attention: { label: string; hint: string; action?: () => void }[] = useMemo(() => {
    const c = app.counts;
    const out: { label: string; hint: string; action?: () => void }[] = [];
    if (c.updates > 0)
      out.push({
        label: `${pluralize(c.updates, "skill has")} updates`,
        hint: "Install new versions from the library",
        action: () => app.setScreen("skills"),
      });
    const singleAgentSkills = app.agents.filter((a) => a.detected && a.skillCount === 0).length;
    if (c.modified > 0)
      out.push({
        label: `${pluralize(c.modified, "skill is")} modified externally`,
        hint: "Review changes and acknowledge",
        action: () => app.setScreen("skills"),
      });
    if (c.broken > 0)
      out.push({
        label: `${pluralize(c.broken, "skill")} missing`,
        hint: "The folders are gone — rescan or remove",
        action: () => app.setScreen("skills"),
      });
    if (c.duplicates > 0)
      out.push({
        label: `${pluralize(c.duplicates, "set of duplicate")} installations`,
        hint: "Identical copies across agents",
        action: () => app.setScreen("skills"),
      });
    if (singleAgentSkills > 0)
      out.push({
        label: `${pluralize(singleAgentSkills, "agent")} without skills`,
        hint: "Install something for them from the marketplace",
        action: () => app.setScreen("marketplace"),
      });
    return out;
  }, [app]);

  const detected = detectedAgents(app.agents);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-8 py-10">
        <h2 className="text-xl font-semibold tracking-tight text-text">{heading}</h2>
        <p className="mt-1 text-sm text-muted">Your AI workspace is healthy.</p>

        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2">
          <Stat value={app.counts.skills} label="skills" />
          <Stat value={detected.length} label="agents" />
          <Stat
            value={app.counts.duplicates}
            label="duplicate sets"
            warn={app.counts.duplicates > 0}
          />
          <Stat
            value={app.counts.modified + app.counts.broken}
            label="need attention"
            warn={app.counts.modified + app.counts.broken > 0}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <section aria-label="Recent activity">
            <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
              Recent activity
            </h3>
            <div className="mt-2 divide-y divide-border/60 rounded-[8px] border border-border">
              {recent.slice(0, 6).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    app.setInspector(s.path);
                    app.setScreen("skills");
                    skills.openDetail(s.path, s);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left transition-colors hover:bg-hover"
                >
                  <SkillGlyph name={s.name} description={s.description} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{s.name}</span>
                    <span className="block truncate text-2xs text-faint">
                      {s.status === "modified"
                        ? "Modified externally"
                        : s.scope === "project"
                          ? "Project skill"
                          : "Global skill"}
                    </span>
                  </span>
                  <span className="shrink-0 text-2xs text-faint tabular">{timeAgo(s.mtimeMs)}</span>
                </button>
              ))}
              {recent.length === 0 && (
                <div className="px-3 py-3 text-sm text-muted">
                  Nothing scanned yet — the first scan runs in the background.
                </div>
              )}
            </div>
          </section>

          <section aria-label="Needs attention">
            <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
              Needs attention
            </h3>
            <div className="mt-2 space-y-1.5">
              {attention.length === 0 && (
                <div className="flex items-center gap-2 rounded-[8px] border border-border bg-surface px-3 py-2.5">
                  <ShieldCheck className="size-3.5 text-success" />
                  <span className="text-sm text-muted">Nothing needs your attention.</span>
                </div>
              )}
              {attention.map((a) => (
                <button
                  key={a.label}
                  onClick={a.action}
                  className="flex w-full items-center gap-2.5 rounded-[8px] border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-hover"
                >
                  <AlertTriangle className="size-3.5 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text">{a.label}</span>
                    <span className="block text-2xs text-faint">{a.hint}</span>
                  </span>
                  <ArrowRight className="size-3 shrink-0 text-faint" />
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-[8px] border border-border bg-surface px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Compass className="size-3.5 text-accent" />
                <span className="text-sm font-medium text-text">Explore the marketplace</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Find community skills from the skills.sh ecosystem and install them in one step.
              </p>
              <Button
                variant="subtle"
                size="sm"
                className="mt-2"
                onClick={() => app.setScreen("marketplace")}
              >
                Discover skills
                <ArrowRight className="size-3" />
              </Button>
            </div>

            <div className="mt-3 rounded-[8px] border border-border bg-surface px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Plus className="size-3.5 text-accent" />
                <span className="text-sm font-medium text-text">Write your own</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Create a skill from a template and install it for the agents you use.
              </p>
              <Button
                variant="subtle"
                size="sm"
                className="mt-2"
                onClick={() => window.dispatchEvent(new CustomEvent("skillbench:new-skill"))}
              >
                <Plus className="size-3" />
                New skill
              </Button>
            </div>
          </section>
        </div>

        <p className="mt-10 text-center text-2xs text-faint">
          Everything stays on this machine. Your skills are your files.
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn("text-xl font-semibold tabular", warn ? "text-warning" : "text-text")}>
        {value}
      </span>
      <span className={cn("text-sm", warn ? "text-warning" : "text-faint")}>{label}</span>
      <StatusDot status="ok" className={cn("ml-0", warn ? "bg-warning" : "opacity-0")} />
    </div>
  );
}
