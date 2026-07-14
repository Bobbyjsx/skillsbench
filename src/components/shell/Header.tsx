import { RefreshCw, Search, Menu } from "lucide-react";
import { useApp, type Screen } from "../../stores/app";
import { mod } from "../../lib/keys";
import { Kbd } from "../ui/Misc";
import { cn } from "../../lib/cn";
import { api } from "../../api/client";
import { toast } from "../../stores/toasts";

const TITLES: Record<Screen, string> = {
  overview: "Overview",
  skills: "Skills",
  marketplace: "Discover",
  groups: "Groups",
  agents: "Agents",
  projects: "Projects",
  settings: "Settings",
  editor: "Edit skill",
};

export function Header() {
  const { screen, setPalette, setScreen, scanRunning, counts, toggleMobileSidebar } = useApp();

  const runScan = async () => {
    toast.info("Scanning for changes…");
    await api.scanNow();
  };

  const attentionCount = counts.modified + counts.broken;

  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-bg px-3">
      <div className="flex min-w-0 items-baseline gap-1.5 select-none">
        <button
          onClick={toggleMobileSidebar}
          className="mr-1 flex items-center justify-center rounded-[6px] p-1 text-faint transition-colors hover:bg-hover hover:text-muted md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="size-4" />
        </button>
        {screen !== "overview" && (
          <>
            <button
              onClick={() => setScreen("overview")}
              className="text-sm text-faint transition-colors hover:text-muted hidden sm:block"
            >
              Skillbench
            </button>
            <span className="text-faint hidden sm:block">/</span>
          </>
        )}
        <h1 className="truncate text-md font-semibold text-text">{TITLES[screen]}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {attentionCount > 0 && (
          <button
            onClick={() => setScreen("skills")}
            className="flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-2xs font-medium text-warning transition-colors hover:bg-warning-soft"
          >
            <span className="size-1.5 rounded-full bg-warning" />
            {attentionCount} need{attentionCount === 1 ? "s" : ""} attention
          </button>
        )}

        <button
          onClick={runScan}
          aria-label="Scan for changes"
          title="Scan for changes"
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-[6px] text-faint transition-colors duration-150 hover:bg-hover hover:text-muted",
            scanRunning && "animate-spin text-accent [animation-duration:1.1s]",
          )}
        >
          <RefreshCw className="size-3.5" strokeWidth={1.75} />
        </button>

        <button
          onClick={() => setPalette(true)}
          className="flex h-7 items-center gap-2 rounded-[7px] border border-border bg-surface-2 px-2.5 text-sm text-faint transition-colors duration-120 hover:border-border-strong hover:text-muted"
          aria-label="Open command palette"
        >
          <Search className="size-3.5" strokeWidth={1.75} />
          <span className="hidden lg:inline">Search skills, run commands…</span>
          <span className="lg:hidden">Search…</span>
          <Kbd className="ml-1">{mod}K</Kbd>
        </button>
      </div>
    </header>
  );
}
