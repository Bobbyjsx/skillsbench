import { useEffect, useState } from "react";
import { Layers, Plus, Trash2, Pencil, Package2 } from "lucide-react";
import { useApp } from "../../stores/app";
import { useGroups } from "../../stores/groups";
import { api } from "../../api/client";
import type { SkillSummary } from "../../types/api";
import { EmptyState } from "../ui/EmptyState";
import { Button, IconButton } from "../ui/Button";
import { Input } from "../ui/Input";
import { SkillGlyph } from "../skills/SkillGlyph";
import { cn } from "../../lib/cn";

export function GroupsPage() {
  const app = useApp();
  const groups = useGroups();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [newName, setNewName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    groups.load();
  }, [groups]);

  const selected = groups.groups.find((g) => g.id === selectedId) ?? groups.groups[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setSkills([]);
      return;
    }
    api
      .listSkills({ group: selected.name, limit: 500 })
      .then(setSkills)
      .catch(() => setSkills([]));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (g: { id: number; name: string }) => {
    await groups.remove(g.id);
    setSkills([]);
  };

  const handleCreateGroup = async () => {
    if (newName.trim()) {
      const g = await groups.create(newName.trim());
      if (g) setSelectedId(g.id);
      setNewName("");
      setIsCreatingGroup(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-bg">
      {/* Sidebar */}
      <div className="w-[300px] shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-6 py-8">
          <div className="flex items-center gap-2 mb-6">
            <Layers className="size-5 text-accent" />
            <h1 className="text-xl font-medium tracking-tight text-text">Groups</h1>
            <span className="ml-auto rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
              {groups.groups.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-0.5">
          {groups.groups.map((g) => (
            <div
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                selected?.id === g.id
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:bg-hover hover:text-text",
              )}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
              <span
                className={cn(
                  "tabular text-xs",
                  selected?.id === g.id ? "text-white/80" : "text-faint",
                )}
              >
                {g.skillCount}
              </span>
              <span
                className={cn(
                  "hidden items-center gap-1 group-hover:flex ml-2",
                  selected?.id === g.id ? "text-white" : "",
                )}
              >
                <button
                  className={cn(
                    "p-1 rounded opacity-60 hover:opacity-100 transition-opacity",
                    selected?.id === g.id ? "hover:bg-white/20" : "hover:bg-surface-2",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    groups.renameStart(g);
                  }}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  className={cn(
                    "p-1 rounded opacity-60 hover:opacity-100 transition-opacity",
                    selected?.id === g.id
                      ? "hover:bg-white/20 hover:text-white"
                      : "hover:bg-surface-2 hover:text-danger",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(g);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          ))}

          {groups.renameTarget && (
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-accent bg-surface-2 px-3 py-2 shadow-sm">
              <input
                autoFocus
                value={groups.renameValue}
                onChange={(e) => groups.setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") groups.renameCommit();
                  if (e.key === "Escape") groups.renameCancel();
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border mt-auto">
          {isCreatingGroup ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3 p-3 bg-surface-2 rounded-lg border border-border">
              <label className="text-xs font-medium text-faint uppercase tracking-wider">
                Group Name
              </label>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateGroup();
                  if (e.key === "Escape") {
                    setIsCreatingGroup(false);
                    setNewName("");
                  }
                }}
                placeholder="E.g. Code Review"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingGroup(false);
                    setNewName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleCreateGroup}
                  disabled={!newName.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full gap-2 justify-center border-dashed"
              onClick={() => setIsCreatingGroup(true)}
            >
              <Plus className="size-4" />
              Create Group
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-surface-2/50">
        {!selected ? (
          <div className="h-full flex items-center justify-center p-8">
            <EmptyState
              icon={<Package2 className="size-8 text-faint" />}
              title="Organize your toolkit"
              description="Create groups to categorize your agents and skills. Files stay where they are, but you stay organized."
            />
          </div>
        ) : (
          <div className="mx-auto max-w-4xl p-8 lg:p-12">
            <div className="mb-10">
              <h2 className="text-3xl font-semibold tracking-tight text-text mb-2">
                {selected.name}
              </h2>
              <p className="text-muted text-sm flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-accent/40" />
                {skills.length} {skills.length === 1 ? "skill" : "skills"} in this collection
              </p>
            </div>

            {skills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-surface/50 p-12 text-center flex flex-col items-center justify-center gap-3">
                <Package2 className="size-6 text-faint mb-2" />
                <h3 className="text-sm font-medium text-text">No skills assigned</h3>
                <p className="text-sm text-muted max-w-[280px]">
                  Open any skill in the app and assign it to this group from the inspector panel.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skills.map((s) => (
                  <button
                    key={s.path}
                    onClick={() => {
                      app.setInspector(s.path);
                      app.setScreen("skills");
                    }}
                    className="group flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-5 text-left transition-all duration-200 hover:border-accent hover:shadow-sm"
                  >
                    <div className="flex w-full items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <SkillGlyph name={s.name} description={s.description} size="lg" />
                        <div>
                          <h4 className="font-medium text-text truncate group-hover:text-accent transition-colors">
                            {s.name}
                          </h4>
                          <p className="text-xs text-muted mt-0.5 truncate">
                            {s.author || "Local"}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-faint uppercase tracking-wider">
                        {s.scope}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                        {s.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
