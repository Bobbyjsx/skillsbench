import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface MenuItem {
  label?: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  kbd?: string;
  separator?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  children: (open: boolean) => ReactNode;
  align?: "start" | "end";
  width?: number;
}

export function Menu({ items, children, align = "end", width = 220 }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <div
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {children(open)}
      </div>
      {open && (
        <div
          role="menu"
          style={{ width }}
          className={cn(
            "absolute z-40 mt-1 overflow-hidden rounded-[8px] border border-border-strong bg-surface-2 py-1",
            "shadow-[var(--shadow-pop)] animate-[menu-in_120ms_var(--sb-ease)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) =>
            item.separator ? (
              <div key={i} className="mx-2 my-1 border-t border-border" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-sm transition-colors duration-100",
                  "hover:bg-active hover:text-text disabled:opacity-40",
                  item.danger ? "text-danger" : "text-muted",
                )}
              >
                <span className="text-truncate">{item.label}</span>
                {item.kbd && <span className="text-2xs text-faint">{item.kbd}</span>}
              </button>
            ),
          )}
        </div>
      )}
      <style>{`
        @keyframes menu-in { from { opacity: 0; transform: translateY(-3px) scale(0.99) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}
