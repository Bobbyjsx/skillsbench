import { cn } from "../../lib/cn";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  className?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[7px] border border-border bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex h-6 items-center gap-1.5 rounded-[5px] px-2 text-sm transition-colors duration-120 ease-app",
            value === opt.value
              ? "bg-surface-3 text-text shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
              : "text-muted hover:text-text",
          )}
        >
          {opt.label}
          {typeof opt.count === "number" && opt.count > 0 && (
            <span
              className={cn("tabular text-2xs", value === opt.value ? "text-faint" : "text-faint")}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="group flex cursor-pointer items-start gap-2.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-120 ease-app",
          checked
            ? "border-accent bg-accent text-bg"
            : "border-border-strong bg-surface-2 group-hover:border-accent/50",
        )}
      >
        {checked && (
          <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-current stroke-2">
            <path d="M1 4l2.5 2.5L9 1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="leading-tight">
        <span className="block text-sm text-text">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-faint">{description}</span>}
      </span>
    </label>
  );
}

export function Radio({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="group flex cursor-pointer items-start gap-2.5 select-none">
      <input type="radio" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-120 ease-app",
          checked
            ? "border-accent"
            : "border-border-strong bg-surface-2 group-hover:border-accent/50",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span className="leading-tight">
        <span className="block text-sm text-text">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-faint">{description}</span>}
      </span>
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-label="Loading"
      className={cn(
        "inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-border-strong border-t-accent",
        className,
      )}
    />
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-2xs font-semibold uppercase tracking-[0.08em] text-faint select-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
