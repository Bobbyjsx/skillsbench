import { useState } from "react";
import { RotateCw } from "lucide-react";
import { useApp } from "../../stores/app";
import { applyTheme } from "../../lib/theme";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Controls";
import { makePathDisplay } from "../../lib/paths";
import { cn } from "../../lib/cn";
import { toast } from "../../stores/toasts";

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export function SettingsPage() {
  const app = useApp();
  const [scanning, setScanning] = useState(false);

  const setTheme = async (t: "dark" | "light" | "system") => {
    app.setTheme(t);
    applyTheme({ theme: t });
  };

  const rescanAll = async () => {
    setScanning(true);
    try {
      await app.scanNow();
      toast.info("Scan started — results appear as it completes");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[560px] px-8 py-10">
        <h2 className="text-xl font-semibold tracking-tight text-text">Settings</h2>

        <section className="mt-6">
          <SectionTitle title="Appearance" />
          <Segmented
            value={app.settings.theme}
            onChange={setTheme}
            options={THEME_OPTIONS.map((o) => ({
              value: o.value as "dark" | "light" | "system",
              label: o.label,
            }))}
          />
        </section>

        <section className="mt-8">
          <SectionTitle title="Skills" />
          <div className="rounded-[8px] border border-border bg-surface p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">Rescan everything</span>
              <span className="ml-auto" />
              <Button size="sm" variant="subtle" onClick={rescanAll} disabled={scanning}>
                <RotateCw className={cn("size-3.5", scanning && "animate-spin")} />
                {scanning ? "Scanning…" : "Scan now"}
              </Button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Walks every watched folder (agents + projects) and refreshes the library index. Normal
              scans run automatically in the background.
            </p>
          </div>

          <div className="mt-2 rounded-[8px] border border-border bg-surface p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">Security scanning</span>
              <StatusPill className="ml-auto" />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Every skill is statically analyzed for risky patterns (network downloads, credential
              access, destructive operations). The review is always available in the skill inspector
              — and never blocks installing anything.
            </p>
          </div>
        </section>

        <section className="mt-8">
          <SectionTitle title="This machine" />
          <div className="rounded-[8px] border border-border bg-surface p-3.5 text-sm">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted">Watched root</span>
              <span className="text-2xs text-faint tabular">
                {makePathDisplay(app.home).display(app.home)}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted">Skills indexed</span>
              <span className="text-2xs text-faint tabular">{app.counts.skills}</span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-muted">Instances</span>
              <span className="text-2xs text-faint tabular">{app.counts.instances}</span>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <SectionTitle title="About" />
          <div className="rounded-[8px] border border-border bg-surface p-3.5">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-text">Skillbench</span>
              <span className="text-2xs text-faint tabular">0.1.0</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              A local-first manager for AI agent skills. No accounts, no cloud — the filesystem is
              the source of truth and the database is only an index. If you delete this app, your
              skills stay exactly where they are.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-faint">{title}</h3>;
}

function StatusPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-[4px] border border-success/40 bg-success/10 px-1.5 py-0.5 text-2xs font-medium text-success",
        className,
      )}
    >
      Always on
    </span>
  );
}
