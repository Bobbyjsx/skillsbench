import type { ReactNode } from "react";
import type { SkillStatus } from "../../types/api";
import { cn } from "../../lib/cn";

const statusTone: Record<SkillStatus, string> = {
  ok: "text-success",
  update: "text-accent",
  modified: "text-warning",
  broken: "text-danger",
  invalid: "text-faint",
  untracked: "text-faint",
};

const statusLabel: Record<SkillStatus, string> = {
  ok: "Installed",
  update: "Update available",
  modified: "Modified",
  broken: "Broken",
  invalid: "Invalid",
  untracked: "Untracked",
};

export function StatusDot({ status, className }: { status: SkillStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 shrink-0 rounded-full", statusTone[status], className)}
    />
  );
}

export function StatusChip({ status, className }: { status: SkillStatus; className?: string }) {
  const isBroken = status === "broken" || status === "invalid";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] px-1.5 py-0.5 text-2xs font-medium",
        !isBroken && "text-muted",
        className,
      )}
    >
      <StatusDot status={status} />
      {statusLabel[status]}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: string }) {
  const tone =
    risk === "high"
      ? "text-danger bg-danger-soft"
      : risk === "medium"
        ? "text-warning bg-warning-soft"
        : risk === "low"
          ? "text-accent bg-accent-soft"
          : "text-success bg-success/8 text-success";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-2xs font-medium",
        tone,
      )}
    >
      {risk === "none" ? "No risk detected" : `${risk[0].toUpperCase()}${risk.slice(1)} risk`}
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] border border-border bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
