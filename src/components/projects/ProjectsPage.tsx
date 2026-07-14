import { useState } from "react";
import { Check, FolderOpen, FolderPlus, FolderSearch, Trash2 } from "lucide-react";
import { useApp } from "../../stores/app";
import { api } from "../../api/client";
import { makePathDisplay } from "../../lib/paths";
import { Button } from "../ui/Button";
import type { ProjectInfo } from "../../types/api";
import { toast } from "../../stores/toasts";

export function ProjectsPage() {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const [path, setPath] = useState("");
  const [pending, setPending] = useState(false);

  const add = async () => {
    const p = path.trim();
    if (!p) return;
    setPending(true);
    try {
      const proj = await api.addProjectRoot(p);
      toast.success("Project added", proj.name);
      setPath("");
      setAdding(false);
      app.refreshCounts();
      await app.load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setPending(false);
    }
  };

  const browse = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({
        directory: true,
        multiple: false,
        title: "Choose a project folder",
      });
      if (typeof picked === "string" && picked) {
        setPath(picked);
      }
    } catch (e) {
      toast.error(String(e));
    }
  };

  const remove = async (p: ProjectInfo) => {
    try {
      await api.removeProjectRoot(p.path);
      app.load();
      app.refreshCounts();
      toast.info("Project removed", p.name);
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-8 py-10">
        <h2 className="text-xl font-semibold tracking-tight text-text">Projects</h2>
        <p className="mt-1 text-sm text-muted">
          Repositories with project-scoped skills. Skills inside these folders only apply to that
          project.
        </p>

        <div className="mt-6 space-y-2">
          {app.projects.map((p) => (
            <div
              key={p.path}
              className="flex items-center gap-3 rounded-[8px] border border-border bg-surface px-3.5 py-3"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-hover">
                <FolderOpen className="size-3.5 text-faint" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">{p.name}</span>
                  {app.projects.some((x) => x.path === p.path && x.skillCount === p.skillCount) && (
                    <Check className="size-3 text-success" />
                  )}
                </div>
                <div className="mt-0.5 truncate text-2xs text-faint tabular">
                  {makePathDisplay(app.home).display(p.path)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular text-text">{p.skillCount}</div>
                <div className="text-2xs text-faint">skills</div>
              </div>
              <button
                onClick={() => remove(p)}
                aria-label={`Remove ${p.name}`}
                className="flex size-7 items-center justify-center rounded-[6px] text-faint transition-colors hover:bg-hover hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}

          {app.projects.length === 0 && !adding && (
            <div className="rounded-[8px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              No project roots yet. Add one to start tracking project-scoped skills.
            </div>
          )}

          {adding && (
            <div className="flex items-center gap-2 rounded-[8px] border border-border bg-surface px-3 py-2">
              <Button size="sm" variant="subtle" onClick={browse} title="Pick a folder from Finder">
                <FolderSearch className="size-3.5" />
                Browse…
              </Button>
              <span className="text-2xs text-faint">or type a path</span>
              <input
                autoFocus
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add();
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder="/path/to/project"
                aria-label="Project path"
                className="h-7 min-w-0 flex-1 rounded-[6px] border border-border bg-surface-2 px-2 text-sm text-text placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
              <Button size="sm" onClick={add} disabled={pending || !path.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        <Button variant="subtle" size="sm" className="mt-3" onClick={() => setAdding(true)}>
          <FolderPlus className="size-3.5" />
          Add project
        </Button>
      </div>
    </div>
  );
}
