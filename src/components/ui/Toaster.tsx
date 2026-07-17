import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";
import { useToasts, type Toast } from "../../stores/toasts";
import { cn } from "../../lib/cn";

const icon = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

const tone = {
  success: "text-success",
  info: "text-muted",
  warning: "text-warning",
  error: "text-danger",
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-1.5"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ t, onDismiss }: { t: Toast; onDismiss: () => void }) {
  const Icon = icon[t.kind];
  return (
    <div
      className={cn(
        "pointer-events-auto flex max-w-[440px] items-start gap-2.5 rounded-[8px] border border-border-strong bg-surface-2 px-3 py-2",
        "shadow-[var(--shadow-pop)] animate-[toast-in_160ms_var(--sb-ease)]",
      )}
      role="status"
    >
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", tone[t.kind])} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{t.title}</div>
        {t.description && (
          <div className="mt-0.5 text-xs leading-relaxed text-muted">{t.description}</div>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-1 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-faint hover:bg-hover hover:text-text"
      >
        <X className="size-3" />
      </button>
      <style>{`
        @keyframes toast-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}
