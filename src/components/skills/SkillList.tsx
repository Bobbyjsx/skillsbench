import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useApp } from "../../stores/app";
import { cn } from "../../lib/cn";
import { timeAgo } from "../../lib/format";
import { StatusChip, StatusDot } from "../ui/Badge";
import { SkillGlyph } from "./SkillGlyph";
import { agentShort } from "../../lib/agents";
import { Menu, type MenuItem } from "../ui/Menu";
import { MoreHorizontal, Check } from "lucide-react";
import { mod } from "../../lib/keys";
import { api } from "../../api/client";
import { toast } from "../../stores/toasts";
import { PAGE, useSkills } from "../../stores/skills";
import type { SkillSummary } from "../../types/api";

export function SkillRow_({
  skill,
  selected,
  onSelect,
  onAction,
}: {
  skill: SkillSummary;
  selected: boolean;
  onSelect: () => void;
  onAction: () => void;
}) {
  const items: MenuItem[] = [
    {
      label: "Open skill",
      onSelect: onSelect,
    },
    {
      label: "Edit SKILL.md",
      onSelect: onAction,
      kbd: `${mod}E`,
    },
    { separator: true },
    ...(skill.status === "modified" || skill.status === "broken"
      ? [
          {
            label: "Acknowledge changes",
            onSelect: () => {
              api.acknowledgeSkill(skill.path).then(() => toast.success("Changes acknowledged"));
            },
          } satisfies MenuItem,
        ]
      : []),
    {
      label: "Uninstall",
      danger: true,
      onSelect: () => {
        window.dispatchEvent(
          new CustomEvent("skillbench:uninstall", {
            detail: { path: skill.path, name: skill.name },
          }),
        );
      },
    },
  ];

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onAction}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect();
      }}
      aria-selected={selected}
      className={cn(
        "group mx-1 flex cursor-pointer items-center gap-3 rounded-[7px] px-2.5 py-[7px] transition-colors duration-100",
        selected ? "bg-active" : "hover:bg-hover",
      )}
    >
      <SkillGlyph name={skill.name} description={skill.description} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-truncate text-sm font-medium text-text">{skill.name}</span>
          {skill.scope === "project" && (
            <span className="rounded-[4px] border border-border bg-surface-2 px-1 py-px text-2xs text-faint">
              {skill.projectPath
                ? (skill.projectPath.split("/").filter(Boolean).slice(-2, -1)[0] ?? "project")
                : "project"}
            </span>
          )}
          {skill.duplicateCount > 0 && (
            <span className="tabular text-2xs text-faint">
              ×{skill.duplicateCount + 1} installs
            </span>
          )}
        </div>
        <div className="text-truncate text-sm text-muted">
          {skill.description ?? "No description"}
        </div>
      </div>

      <div className="hidden items-center gap-1 md:flex" aria-hidden>
        {skill.agentIds.map((id) => (
          <span
            key={id}
            title={agentShort(id)}
            className="flex h-[18px] items-center rounded-[4px] border border-border bg-surface-2 px-1.5 text-2xs font-medium text-faint"
          >
            {agentShort(id)}
          </span>
        ))}
        {skill.agentIds.length === 0 && <span className="text-2xs text-faint">no agents</span>}
      </div>

      <StatusChip status={skill.status} className="hidden w-[104px] lg:flex" />

      <span className="hidden w-16 text-right text-2xs text-faint tabular sm:block">
        {timeAgo(skill.mtimeMs)}
      </span>

      <Menu items={items} width={210}>
        {(open) => (
          <span
            role="button"
            aria-label={`Actions for ${skill.name}`}
            className={cn(
              "flex size-6 items-center justify-center rounded-[5px] text-faint transition-all duration-100",
              open
                ? "bg-active text-text"
                : "opacity-0 group-hover:opacity-100 hover:bg-active hover:text-text",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-3.5" />
          </span>
        )}
      </Menu>
    </div>
  );
}

export const SkillRow = memo(SkillRow_);

import { useShallow } from "zustand/react/shallow";

export function SkillList() {
  const { items, loaded, loadingMore, loadMore, openDetail } = useSkills(
    useShallow((s) => ({
      items: s.items,
      loaded: s.loaded,
      loadingMore: s.loadingMore,
      loadMore: s.loadMore,
      openDetail: s.openDetail,
    })),
  );
  const { openEditor, inspectorPath, setInspector } = useApp(
    useShallow((s) => ({
      openEditor: s.openEditor,
      inspectorPath: s.inspectorPath,
      setInspector: s.setInspector,
    })),
  );
  const parentRef = useRef<HTMLDivElement>(null);

  const startEditing = (skill: SkillSummary) => {
    openEditor(skill.path, "SKILL.md");
  };

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 58,
    overscan: 12,
    getItemKey: (i) => items[i]?.id ?? i,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;

  if (!loaded && items.length === 0) {
    return (
      <div className="h-full overflow-hidden py-1.5" role="status" aria-label="Loading skills">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="mx-1 flex items-center gap-3 rounded-[7px] px-2.5 py-[7px]">
            <div className="size-8 shrink-0 animate-pulse rounded-[6px] bg-hover" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-1/3 animate-pulse rounded-[3px] bg-hover" />
              <div className="h-3 w-2/3 animate-pulse rounded-[3px] bg-hover/70" />
            </div>
          </div>
        ))}
        <div className="px-3 pt-2 text-2xs text-faint">Loading your skills…</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <div className="text-md font-medium text-text">No skills found</div>
        <div className="max-w-[360px] text-sm text-muted">
          Adjust the filters, or install your first skill from the marketplace.
        </div>
      </div>
    );
  }

  const onReachEnd = () => {
    if (lastIndex >= items.length - 8) loadMore();
  };

  return (
    <div
      ref={parentRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
          onReachEnd();
        }
      }}
      className="h-full overflow-y-auto py-1.5"
      role="listbox"
      aria-label="Skills"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualItems.map((vi) => {
          const item = items[vi.index];
          if (!item) return null;
          const selected = inspectorPath === item.path;
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <SkillRow
                skill={item}
                selected={selected}
                onSelect={() => {
                  setInspector(item.path);
                  openDetail(item.path, item);
                }}
                onAction={() => startEditing(item)}
              />
            </div>
          );
        })}
      </div>
      {loadingMore && (
        <div className="flex justify-center py-3">
          <span className="size-3.5 animate-spin rounded-full border-[1.5px] border-border-strong border-t-accent" />
        </div>
      )}
      {!loadingMore && items.length > 0 && (
        <div className="flex flex-col items-center gap-0.5 py-3 text-2xs text-faint">
          {items.length >= PAGE ? (
            <span className="flex items-center gap-1.5">
              <span className="flex items-center gap-1" aria-hidden>
                <StatusDot status="ok" className="opacity-40" />
              </span>
              Showing first {items.length} — scroll for more
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-success" />
              You're all caught up — {items.length} skill{items.length === 1 ? "" : "s"} in this
              view.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
