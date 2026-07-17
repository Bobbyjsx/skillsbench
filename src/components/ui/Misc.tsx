import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border-strong bg-surface-2 px-1 text-2xs font-medium text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-[6px]",
          "border border-border-strong bg-surface-3 px-2 py-1 text-xs text-text",
          "opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-100",
          "group-hover/tip:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}
