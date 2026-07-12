import { useState } from "react";
import { Check, FolderOpen, RotateCw } from "lucide-react";
import { useApp } from "../../stores/app";
import { agentMeta, orderedAgents } from "../../lib/agents";
import { Button } from "../ui/Button";
import { StatusDot } from "../ui/Badge";
import { makePathDisplay } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { toast } from "../../stores/toasts";

export function AgentsPage() {
  const app = useApp();
  const [rescanning, setRescanning] = useState(false);

  const rescan = async () => {
    setRescanning(true);
    try {
      await app.refreshAgents();
      await app.refreshCounts();
      toast.success("Agents rescanned");
    } finally {
      setRescanning(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-8 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-text">Agents</h2>
            <p className="mt-1 text-sm text-muted">
              The AI coding CLIs whose skill folders Skillbench watches.
            </p>
          </div>
          <Button variant="subtle" size="sm" onClick={rescan} disabled={rescanning}>
            <RotateCw className={cn("size-3.5", rescanning && "animate-spin")} />
            {rescanning ? "Rescanning…" : "Rescan"}
          </Button>
        </div>

        {app.agents.length === 0 && (
          <div className="mt-6 text-sm text-muted">
            Nothing detected yet. If your agent was installed after Skillbench, press Rescan.
          </div>
        )}

        <div className="mt-6 space-y-2">
          {orderedAgents(app.agents).map((a) => {
            const meta = agentMeta(a.id);
            const projectOnly = a.globalDirs.length === 0 && a.projectDirNames.length > 0;
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-3 rounded-[8px] border px-3.5 py-3",
                  a.detected ? "border-border bg-surface" : "border-border/60 bg-surface/40",
                )}
              >
                <div
                  className={cn(
                    "relative flex size-8 shrink-0 items-center justify-center rounded-[7px] text-sm font-bold",
                    a.detected ? "bg-accent/15 text-accent" : "bg-hover text-faint",
                  )}
                >
                  {meta.short.slice(0, 2).toUpperCase()}
                  {a.detected && (
                    <StatusDot status="ok" className="absolute -right-0.5 -bottom-0.5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{meta.name}</span>
                    <span className="text-2xs text-faint tabular">
                      {a.version ? `v${a.version}` : ""}
                    </span>
                    {a.binary && (
                      <span className="flex items-center gap-1 rounded-[4px] bg-hover px-1.5 py-0.5 text-2xs text-muted">
                        <Check className="size-3 text-success" /> CLI
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-faint">
                    {!a.detected && (
                      <span className="text-warning">not detected on this machine</span>
                    )}
                    {a.globalDirs.length > 0 &&
                      a.globalDirs.map((d) => (
                        <span key={d} className="flex items-center gap-1">
                          <FolderOpen className="size-3" />
                          {makePathDisplay(app.home).display(d)}
                        </span>
                      ))}
                    {a.globalDirs.length === 0 &&
                      a.projectDirNames.length > 0 &&
                      a.projectDirNames.map((d) => (
                        <span key={d} className="flex items-center gap-1">
                          <FolderOpen className="size-3" />
                          {d}/ in each project
                        </span>
                      ))}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular text-text">{a.skillCount}</div>
                  <div className="text-2xs text-faint">skills</div>
                </div>

                {projectOnly && a.detected && (
                  <div className="shrink-0 rounded-[6px] border border-border bg-hover px-2 py-1 text-2xs text-muted">
                    project skills only
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-[8px] border border-dashed border-border px-3.5 py-3 text-2xs leading-relaxed text-faint">
          Skillbench watches the skill folders of every detected agent above, plus the shared{" "}
          <span className="font-medium text-muted">~/.agents/skills</span> directory when present.
          New agents you install later show up here after a rescan — no restart needed.
        </div>
      </div>
    </div>
  );
}
