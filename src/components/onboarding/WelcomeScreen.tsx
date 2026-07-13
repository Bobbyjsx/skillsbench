import { useState } from "react";
import { ArrowRight, FolderOpen, MousePointerClick, ShieldCheck, Sparkles } from "lucide-react";
import { useApp } from "../../stores/app";
import { Button } from "../ui/Button";
import { api } from "../../api/client";
import { detectedAgents } from "../../lib/agents";

export function WelcomeScreen() {
  const app = useApp();
  const [closing, setClosing] = useState(false);

  const finish = async (persist: boolean) => {
    setClosing(true);
    const t0 = performance.now();
    if (persist) {
      try {
        await api.setSetting("first_launch_done", "true");
        api.logLine(`welcome: setSetting done in ${(performance.now() - t0).toFixed(0)}ms`);
      } catch (e) {
        api.logLine(`welcome: setSetting failed: ${String(e)}`);
      }
    }
    const t1 = performance.now();
    await app.load();
    api.logLine(`welcome: load() done in ${(performance.now() - t1).toFixed(0)}ms`);
  };

  const agents = detectedAgents(app.agents);
  const names =
    agents.length === 0
      ? "your AI agents"
      : agents
          .map((a) => a.name)
          .slice(0, 3)
          .join(", ") + (agents.length > 3 ? "…" : "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg">
      <div className="w-full max-w-[520px] px-8 py-12">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-accent" />
          <span className="text-sm font-semibold tracking-tight text-text">Skillbench</span>
        </div>

        <h1 className="mt-8 text-[28px] font-semibold leading-tight tracking-tight text-text">
          Your skills, managed
          <br />
          like a library.
        </h1>

        <p className="mt-4 max-w-[440px] text-sm leading-relaxed text-muted">
          Skillbench finds every skill installed for <span className="text-text">{names}</span>,
          tracks what changed, scans what you install for risky patterns, and gives you one
          keyboard-first place to create, share and install more.
        </p>

        <div className="mt-8 space-y-2.5">
          <Feature icon={<FolderOpen className="size-4" />} title="Your files stay your files">
            Everything lives on this machine in the folders your agents already read. Skillbench
            only builds an index — delete the app and nothing changes.
          </Feature>
          <Feature icon={<MousePointerClick className="size-4" />} title="Keyboard-first">
            Press {kbd("⌘")}
            {kbd("K")} anywhere. Search your library instantly, jump between screen, and create
            skills without touching the mouse.
          </Feature>
          <Feature icon={<ShieldCheck className="size-4" />} title="Security scanner">
            Every skill is statically checked for anything dangerous before you think about
            installing it — and the review never blocks you.
          </Feature>
        </div>

        <div className="mt-10 flex items-center gap-3">
          <Button onClick={() => finish(true)} disabled={closing}>
            Get started
            <ArrowRight className="size-4" />
          </Button>
          <button
            onClick={() => finish(false)}
            className="text-sm text-faint transition-colors hover:text-text"
          >
            Skip
          </button>
        </div>

        <p className="mt-8 text-2xs text-faint">No accounts. No cloud. No telemetry.</p>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-hover text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted">{children}</div>
      </div>
    </div>
  );
}

function kbd(c: string) {
  return (
    <kbd className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-[4px] border border-border px-1 font-mono text-[10px] text-muted">
      {c}
    </kbd>
  );
}
