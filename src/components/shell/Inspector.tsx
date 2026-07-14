import { useEffect, useState } from "react";
import {
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  Layers,
  Pin,
  PinOff,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "../../stores/app";
import { useSkills } from "../../stores/skills";
import { useGroups } from "../../stores/groups";
import { agentShort } from "../../lib/agents";
import { makePathDisplay } from "../../lib/paths";
import { formatSize, timeAgo } from "../../lib/format";
import { cn } from "../../lib/cn";
import { SectionLabel, Spinner } from "../ui/Controls";
import { StatusChip, RiskBadge } from "../ui/Badge";
import { SkillGlyph } from "../skills/SkillGlyph";
import { Button, IconButton } from "../ui/Button";
import { toast } from "../../stores/toasts";
import { api } from "../../api/client";
import { GroupAssignPopover } from "./GroupAssign";
import { FilePreview } from "../dialogs/FilePreview";

export function Inspector() {
  const app = useApp();
  const skills = useSkills();
  const groups = useGroups();
  const detail = skills.detail;

  useEffect(() => {
    groups.load();
  }, []);

  if (!app.inspectorOpen || !app.inspectorPath) return null;

  const close = () => app.setInspector(null);

  return (
    <aside
      className={cn(
        "flex w-[340px] shrink-0 animate-[inspector-in_160ms_var(--sb-ease)] flex-col border-l border-border bg-bg",
        "absolute right-0 top-0 bottom-0 z-30 shadow-2xl xl:static xl:shadow-none xl:z-auto",
      )}
      aria-label="Skill inspector"
    >
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <span className="text-sm font-semibold text-text">Details</span>
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton
            label={app.inspectorPinned ? "Unpin inspector" : "Pin inspector"}
            onClick={app.toggleInspectorPin}
          >
            {app.inspectorPinned ? (
              <Pin className="size-3.5 text-accent" />
            ) : (
              <PinOff className="size-3.5" />
            )}
          </IconButton>
          <IconButton label="Close inspector" onClick={close}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>

      {skills.detailLoading && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-4" />
        </div>
      )}

      {detail && !skills.detailLoading && <InspectorBody detail={detail} />}
    </aside>
  );
}

function InspectorBody({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof useSkills.getState>["detail"]>;
}) {
  const app = useApp();
  const skills = useSkills();
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const s = detail?.summary;
  if (!s) return null;
  const display = makePathDisplay(app.home);

  const startEdit = () => {
    app.openEditor(s.path, "SKILL.md");
  };

  const openFolder = async () => {
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(s.path);
    } catch {
      toast.error("Couldn't open this folder");
    }
  };

  const uninstall = () => {
    const paths = detail.locations.length > 0 ? detail.locations.map((l) => l.path) : [s.path];
    window.dispatchEvent(
      new CustomEvent("skillbench:uninstall", { detail: { paths, name: s.name } }),
    );
  };

  const mergeToGlobal = async () => {
    try {
      const alreadyGlobal = detail.locations.find(
        (l) => l.agentId === "agents" && l.scope === "global",
      );

      let globalPath = alreadyGlobal?.path;

      if (!alreadyGlobal) {
        const installed = await api.installSkill({
          sourcePath: s.path,
          agents: ["agents"],
          scope: "global",
        });
        if (installed && installed.length > 0) {
          globalPath = installed[0];
        }
      }

      const oldPaths = detail.locations
        .filter((l) => !(l.agentId === "agents" && l.scope === "global"))
        .map((l) => l.path);

      if (oldPaths.length > 0) {
        await api.uninstallSkills({ paths: oldPaths });
      }
      toast.success("Skill merged to global");
      app.refreshCounts();
      await skills.refresh();

      if (globalPath) {
        app.setInspector(globalPath);
        skills.openDetail(globalPath);
      } else {
        skills.closeDetail();
      }
    } catch (e) {
      toast.error("Merge failed", String(e));
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-3.5 pb-4 pt-3">
        <div className="flex items-start gap-2.5">
          <SkillGlyph name={s.name} description={s.description} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-truncate text-lg font-semibold text-text">{s.name}</h2>
              <StatusChip status={s.status} />
            </div>
            {s.description && (
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{s.description}</p>
            )}
          </div>
        </div>

        {s.author && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <span className="text-faint">By</span>
            <span className="font-medium text-text">{s.author}</span>
            <ExternalLink className="size-3 text-faint" />
          </div>
        )}

        {/* installed-for row */}
        <div className="mt-4">
          <SectionLabel className="mb-1.5">Installed for</SectionLabel>
          <div className="flex flex-wrap items-center gap-1">
            {detail.locations.map((loc) => (
              <span
                key={loc.path}
                className="inline-flex items-center gap-1 rounded-[5px] border border-border bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-muted"
              >
                {agentShort(loc.agentId)}
                {loc.scope === "project" && <span className="text-faint">· project</span>}
              </span>
            ))}
            {detail.locations.length === 0 && (
              <span className="text-xs text-faint">Not installed for any agent</span>
            )}
          </div>
          {detail.locations.length > 1 && (
            <div className="mt-2">
              <Button
                variant="subtle"
                size="xs"
                onClick={mergeToGlobal}
                className="w-full justify-center"
              >
                <FolderOpen className="size-3 mr-1" /> Merge to global (.agents)
              </Button>
            </div>
          )}
        </div>

        {/* location */}
        <div className="mt-4">
          <SectionLabel className="mb-1.5">Location</SectionLabel>
          <div className="space-y-1.5">
            {detail.locations.length > 0 ? (
              detail.locations.map((loc) => (
                <div
                  key={loc.path}
                  className="group flex w-full items-center gap-1.5 rounded-[6px] border border-border bg-surface-2 px-2 py-1.5 text-left font-mono text-xs text-muted transition-colors hover:border-border-strong"
                >
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(loc.path);
                      toast.info("Path copied");
                    }}
                    title="Copy path"
                    className="flex min-w-0 flex-1 items-center justify-between"
                  >
                    <span className="min-w-0 flex-1 truncate text-left">
                      {display.display(loc.path)}
                    </span>
                    <Copy className="size-3 shrink-0 text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100 mr-1" />
                  </button>
                  {detail.locations.length > 1 && (
                    <button
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("skillbench:uninstall", {
                            detail: { paths: [loc.path], name: s.name },
                          }),
                        );
                      }}
                      title="Uninstall"
                      className="shrink-0 text-faint hover:text-danger opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(s.path);
                  toast.info("Path copied");
                }}
                title="Copy path"
                className="group flex w-full items-center gap-1.5 rounded-[6px] border border-border bg-surface-2 px-2 py-1.5 text-left font-mono text-xs text-muted transition-colors hover:border-border-strong"
              >
                <span className="min-w-0 flex-1 truncate">{display.display(s.path)}</span>
                <Copy className="size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
          </div>
          <button
            onClick={openFolder}
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-faint transition-colors hover:text-accent"
          >
            <FolderOpen className="size-3" />
            Open folder
          </button>
        </div>

        {/* files */}
        <div className="mt-4">
          <SectionLabel className="mb-1.5">Files</SectionLabel>
          <div className="overflow-hidden rounded-[6px] border border-border">
            <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-2 py-1.5 text-2xs text-faint">
              <FileText className="size-3" />
              {s.fileCount} {s.fileCount === 1 ? "file" : "files"}
            </div>
            <div className="max-h-[160px] overflow-y-auto bg-bg py-0.5">
              {detail.files.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-faint">Folder is empty</div>
              )}
              {detail.files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => f.kind === "file" && setPreviewFile(f.path)}
                  className={cn(
                    "flex w-full items-center gap-1.5 px-2 py-[3px] font-mono text-xs text-muted hover:bg-hover text-left",
                    f.kind === "file" ? "cursor-pointer hover:text-text" : "cursor-default",
                  )}
                  style={{ paddingLeft: 8 + f.depth * 12 }}
                >
                  <span
                    className={cn("shrink-0", f.kind === "dir" ? "text-faint" : "text-faint/70")}
                  >
                    {f.kind === "dir" ? "▸" : "·"}
                  </span>
                  <span className="text-truncate">{f.name}</span>
                  {f.kind === "file" && f.size > 0 && (
                    <span className="ml-auto shrink-0 text-2xs text-faint tabular">
                      {formatSize(f.size)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* groups */}
        <div className="mt-4">
          <SectionLabel className="mb-1.5">Groups</SectionLabel>
          <div className="flex flex-wrap items-center gap-1">
            {s.groups.map((g) => (
              <span
                key={g}
                className="inline-flex items-center gap-1 rounded-[5px] border border-border bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-muted"
              >
                <Layers className="size-2.5" />
                {g}
              </span>
            ))}
            {s.groups.length === 0 && <span className="text-xs text-faint">No groups</span>}
            <GroupAssignPopover skillPath={s.path} current={s.groups} />
          </div>
        </div>

        {/* security */}
        <div className="mt-4">
          <SectionLabel className="mb-1.5">Security</SectionLabel>
          <div className="rounded-[6px] border border-border bg-surface-2 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 text-sm font-medium text-text">
                {detail.security.header}
              </span>
              <span className="shrink-0">
                <RiskBadge risk={detail.security.risk} />
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-2xs text-faint">
              <span>{detail.security.checkedFiles} files checked</span>
              {detail.security.scripts > 0 && <span>{detail.security.scripts} script(s)</span>}
              {detail.security.networks > 0 && (
                <span>{detail.security.networks} network ref(s)</span>
              )}
              {detail.security.credentials > 0 && (
                <span>{detail.security.credentials} credential ref(s)</span>
              )}
              {detail.security.destructive > 0 && (
                <span>{detail.security.destructive} destructive ref(s)</span>
              )}
              {detail.security.findings.length > 0 && (
                <span>{detail.security.findings.length} finding(s) — open the skill to review</span>
              )}
            </div>
            {detail.security.findings.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border pt-2">
                {detail.security.findings.slice(0, 5).map((f, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-2xs text-muted">
                    <span className="mt-0.5 size-1 shrink-0 rounded-full bg-warning" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-text">{f.rule}</span>
                      <span className="text-faint">
                        {" "}
                        — {f.file}:{f.line}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="mt-auto border-t border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={startEdit}>
            <FileText className="size-3.5" />
            Edit
          </Button>
          <Button variant="subtle" size="sm" onClick={openFolder}>
            <FolderOpen className="size-3.5" />
            Open Folder
          </Button>
          <div className="ml-auto">
            <Button variant="danger" size="sm" onClick={uninstall}>
              {detail.locations.length > 1
                ? `Uninstall all (${detail.locations.length})`
                : "Uninstall"}
            </Button>
          </div>
        </div>
        <div className="mt-1.5 text-2xs text-faint">Last changed {timeAgo(s.mtimeMs)}</div>
      </div>
      {previewFile && (
        <FilePreview
          skillPath={s.path}
          filePath={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
