import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  labelledBy?: string;
  hideX?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 440,
  labelledBy,
  hideX,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/45 animate-[fade-in_120ms_var(--sb-ease)]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{ width }}
        className={cn(
          "relative flex max-h-[80vh] flex-col overflow-hidden rounded-[10px] bg-surface",
          "border border-border-strong shadow-[var(--shadow-pop)]",
          "animate-[dialog-in_160ms_var(--sb-ease)] outline-none",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <h2 id={labelledBy} className="text-md font-semibold text-text">
            {title}
          </h2>
          {!hideX && (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="flex size-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-hover hover:text-text"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-4 pb-4 text-sm text-muted">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-bg px-4 py-3">
            {footer}
          </div>
        )}
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dialog-in { from { opacity: 0; transform: translateY(6px) scale(0.98) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  busy,
}: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={400}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={busy}
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
