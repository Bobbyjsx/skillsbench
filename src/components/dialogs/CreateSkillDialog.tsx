import { useEffect, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Checkbox, Radio } from "../ui/Controls";
import { Input } from "../ui/Input";
import { useApp } from "../../stores/app";
import { useSkills } from "../../stores/skills";
import { detectedAgents } from "../../lib/agents";
import { api } from "../../api/client";
import { toast } from "../../stores/toasts";

export function CreateSkillDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate?: () => void;
}) {
  const { agents, projects } = useApp();
  const { openDetail } = useSkills();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"global" | "project">("global");
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setScope("global");
      setProjectPath(projects[0]?.path ?? null);
      setError(null);
      const det = detectedAgents(agents);
      setChecked(Object.fromEntries(det.map((a) => [a.id, true])));
    }
  }, [open, agents, projects]);

  const usable = detectedAgents(agents);
  const submit = async () => {
    if (!name.trim()) {
      setError("Give the skill a name.");
      return;
    }
    const selected = usable.filter((a) => checked[a.id]).map((a) => a.id);
    if (selected.length === 0) {
      setError("Pick at least one agent to install for.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const detail = await api.createSkill({
        name: name.trim(),
        description: description.trim(),
        scope,
        agents: selected,
        projectPath: scope === "project" ? (projectPath ?? undefined) : undefined,
      });
      toast.success("Skill created", name.trim());
      onCreate?.();
      openDetail(detail.summary.path, detail.summary);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Skill"
      labelledBy="create-skill-title"
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {busy ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
            <span className="size-5 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
            <div>
              <div className="text-sm font-medium text-text">
                We received your request — creating "{name.trim()}"…
              </div>
              <div className="mt-1 text-xs leading-relaxed text-muted">
                Writing the skill folders and indexing them for your agents. This usually takes a
                moment — you'll land in the new skill when it's done.
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div>
              <label htmlFor="new-name" className="mb-1 block text-xs font-medium text-muted">
                Name
              </label>
              <Input
                id="new-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="frontend-design"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
            <div>
              <label htmlFor="new-desc" className="mb-1 block text-xs font-medium text-muted">
                Description
              </label>
              <textarea
                id="new-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Build high-quality frontend interfaces."
                rows={2}
                className="w-full resize-none rounded-[6px] border border-border bg-surface-2 px-2.5 py-2 text-sm text-text placeholder:text-faint transition-colors hover:border-border-strong focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent-soft"
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted">Location</div>
              <Radio
                checked={scope === "global"}
                onChange={() => setScope("global")}
                label="Global"
                description="Available to every project on this machine"
              />
              <Radio
                checked={scope === "project"}
                onChange={() => setScope("project")}
                label="Project"
                description="Only inside one project folder"
              />
              {scope === "project" && (
                <select
                  value={projectPath ?? ""}
                  onChange={(e) => setProjectPath(e.target.value)}
                  aria-label="Project"
                  className="mt-1 w-full rounded-[6px] border border-border bg-surface-2 px-2 py-1.5 text-sm text-text focus:outline-none"
                >
                  <option value="" disabled>
                    Choose a project…
                  </option>
                  {projects.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted">Install for</div>
              {usable.length === 0 ? (
                <p className="text-xs text-faint">
                  No agents detected yet — rescan in Agents when available.
                </p>
              ) : (
                usable.map((a) => (
                  <Checkbox
                    key={a.id}
                    checked={checked[a.id] ?? false}
                    onChange={(v) => setChecked((c) => ({ ...c, [a.id]: v }))}
                    label={a.name}
                  />
                ))
              )}
            </div>

            {error && <p className="text-xs font-medium text-danger">{error}</p>}

            <p className="text-xs leading-relaxed text-faint">
              Creates a new folder with a valid SKILL.md and indexes it immediately.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
