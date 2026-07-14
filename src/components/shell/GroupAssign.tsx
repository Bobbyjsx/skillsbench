import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, X } from "lucide-react";
import { useGroups } from "../../stores/groups";
import { useSkills } from "../../stores/skills";
import { api } from "../../api/client";
import { cn } from "../../lib/cn";
import { toast } from "../../stores/toasts";

const WIDTH = 220;

export function GroupAssignPopover({
  skillPath,
  current,
}: {
  skillPath: string;
  current: string[];
}) {
  const { groups, load, create } = useGroups();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8));
      setPos({ top: r.bottom + 6, left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const toggle = async (g: string) => {
    if (current.includes(g)) {
      await api.unassignGroup(g, skillPath);
      toast.info(`Removed from ${g}`);
    } else {
      await api.assignGroup(g, skillPath);
      toast.success(`Added to ${g}`);
    }
    await load();
    useSkills.getState().openDetail(skillPath);
  };

  return (
    <>
      <span ref={anchorRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Assign to group"
          aria-expanded={open}
          className="inline-flex size-[18px] items-center justify-center rounded-[5px] border border-border text-faint transition-colors hover:border-accent/50 hover:text-accent"
          title="Assign to group"
        >
          <Plus className="size-3" />
        </button>
      </span>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div
              role="listbox"
              aria-label="Groups"
              style={{ top: pos.top, left: pos.left, width: WIDTH }}
              className="fixed z-40 overflow-hidden rounded-[8px] border border-border-strong bg-surface-2 p-1 shadow-[var(--shadow-pop)]"
            >
              {groups.length > 0 && (
                <div className="max-h-[180px] overflow-y-auto">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => toggle(g.name)}
                      role="option"
                      aria-selected={current.includes(g.name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-sm transition-colors",
                        "hover:bg-active hover:text-text",
                        current.includes(g.name) ? "text-text" : "text-muted",
                      )}
                    >
                      <span className="text-truncate flex-1 text-left">{g.name}</span>
                      {current.includes(g.name) && <Check className="size-3.5 text-accent" />}
                    </button>
                  ))}
                </div>
              )}
              {creating ? (
                <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-1.5 px-1 pb-0.5">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && name.trim()) {
                        const g = await create(name.trim());
                        if (g) {
                          await api.assignGroup(g.name, skillPath);
                          toast.success("Group created", g.name);
                          setCreating(false);
                          setName("");
                          await load();
                          useSkills.getState().refresh();
                        }
                      }
                      if (e.key === "Escape") setCreating(false);
                    }}
                    placeholder="New group name"
                    className="h-7 min-w-0 flex-1 rounded-[5px] border border-border bg-bg px-2 text-sm text-text placeholder:text-faint focus:border-accent/60 focus:outline-none"
                  />
                  <button
                    onClick={() => setCreating(false)}
                    aria-label="Cancel"
                    className="flex size-7 shrink-0 items-center justify-center rounded-[5px] text-faint hover:bg-hover hover:text-text"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreating(true);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-[5px] border-t border-border px-2 pt-2.5 pb-1.5 text-sm text-accent transition-colors hover:text-accent-strong hover:bg-active"
                >
                  <Plus className="size-3.5" />
                  New group
                </button>
              )}
              {groups.length === 0 && !creating && (
                <div className="px-2 py-1 text-2xs text-faint">No groups yet</div>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
