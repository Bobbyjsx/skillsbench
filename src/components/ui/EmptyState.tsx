import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  className?: string;
}

export function EmptyState({ icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 px-8 text-center",
        className,
      )}
    >
      {icon && <div className="mb-1 text-faint">{icon}</div>}
      <div className="text-md font-medium text-text">{title}</div>
      <div className="max-w-[340px] text-sm leading-relaxed text-muted">{description}</div>
      {actions && (
        <div className="mt-3 flex items-center gap-2">
          {actions.map((a, i) => (
            <Button
              key={i}
              variant={a.primary ? "primary" : "subtle"}
              size="sm"
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", className)}>
      <div className="size-6 animate-pulse rounded-[6px] bg-hover" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 w-1/3 animate-pulse rounded bg-hover" />
        <div className="h-2 w-2/5 animate-pulse rounded bg-hover" />
      </div>
    </div>
  );
}
