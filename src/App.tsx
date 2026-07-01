import { useEffect, useState } from "react";
import { useApp } from "./stores/app";
import { useSkills } from "./stores/skills";
import { toast } from "./stores/toasts";
import { listenToErrors, listenToScan, listenToSkillsChanged } from "./api/client";
import { applyTheme, watchSystemTheme } from "./lib/theme";
import { Sidebar } from "./components/shell/Sidebar";
import { Header } from "./components/shell/Header";
import { Inspector } from "./components/shell/Inspector";
import { CommandPalette } from "./components/palette/CommandPalette";
import { Toaster } from "./components/ui/Toaster";
import { OverviewPage } from "./components/overview/OverviewPage";
import { SkillsPage } from "./components/skills/SkillsPage";
import { MarketplacePage } from "./components/marketplace/MarketplacePage";
import { GroupsPage } from "./components/groups/GroupsPage";
import { AgentsPage } from "./components/agents/AgentsPage";
import { ProjectsPage } from "./components/projects/ProjectsPage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { EditorScreen } from "./components/editor/EditorScreen";
import { WelcomeScreen } from "./components/onboarding/WelcomeScreen";
import { CreateSkillDialog } from "./components/dialogs/CreateSkillDialog";
import { UninstallDialog } from "./components/dialogs/UninstallDialog";

const NAV: Record<string, [string, string]> = {
  "1": ["overview", "overview"],
  "2": ["skills", "skills"],
  "3": ["marketplace", "marketplace"],
};

function App() {
  const app = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [uninstall, setUninstall] = useState<{ paths: string[]; name: string } | null>(null);

  // boot
  useEffect(() => {
    (async () => {
      await app.load();
      applyTheme(useApp.getState().settings);
      const unsubTheme = watchSystemTheme(() => {
        const t = useApp.getState().settings.theme;
        if (t === "system") applyTheme({ theme: t });
      });

      const unsubScan = await listenToScan((e) => {
        if (e.phase === "progress") app.setScanRunning(true);
        if (e.phase === "done") {
          app.setScanRunning(false);
          app.refreshCounts();
          useSkills.getState().refresh();
        }
      });
      const unsubChanged = await listenToSkillsChanged(() => {
        app.refreshCounts();
        useSkills.getState().refresh();
      });
      const unsubErr = await listenToErrors((msg) => toast.error(msg));
      return () => {
        unsubTheme();
        unsubScan();
        unsubChanged();
        unsubErr();
      };
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // window-level skill events (reachable from any screen)
  useEffect(() => {
    const onNew = () => setCreateOpen(true);
    const onUninstall = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setUninstall({ paths: detail.paths || [detail.path], name: detail.name });
    };
    window.addEventListener("skillbench:new-skill", onNew);
    window.addEventListener("skillbench:uninstall", onUninstall);
    return () => {
      window.removeEventListener("skillbench:new-skill", onNew);
      window.removeEventListener("skillbench:uninstall", onUninstall);
    };
  }, []);

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      const k = e.key.toLowerCase();

      if (e.metaKey && k === "k") {
        e.preventDefault();
        app.setPalette(!app.paletteOpen, "all");
        return;
      }
      if (e.metaKey && k === "p") {
        e.preventDefault();
        app.setPalette(true, "skills");
        return;
      }
      if (e.metaKey && k === "n") {
        e.preventDefault();
        setCreateOpen(true);
        return;
      }
      if (typing) return;

      if (e.metaKey && NAV[k]) {
        e.preventDefault();
        app.setScreen(NAV[k][1] as never);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app]);

  if (!app.ready) return null;

  if (!app.welcomeShown) {
    return (
      <>
        <WelcomeScreen />
        <Toaster />
      </>
    );
  }

  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden bg-bg text-text">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1">
          {app.screen === "overview" && <OverviewPage />}
          {app.screen === "skills" && <SkillsPage />}
          {app.screen === "marketplace" && <MarketplacePage />}
          {app.screen === "groups" && <GroupsPage />}
          {app.screen === "agents" && <AgentsPage />}
          {app.screen === "projects" && <ProjectsPage />}
          {app.screen === "settings" && <SettingsPage />}
          {app.screen === "editor" && <EditorScreen />}
        </main>
      </div>
      <Inspector />

      <CommandPalette />
      <Toaster />

      <CreateSkillDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={() => setCreateOpen(false)}
      />
      {uninstall && (
        <UninstallDialog
          paths={uninstall.paths}
          name={uninstall.name}
          onClose={() => setUninstall(null)}
        />
      )}
      {app.scanRunning && (
        <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex items-center gap-2 rounded-full bg-surface-2/90 px-3 py-1.5 text-2xs text-faint shadow-[var(--shadow-pop)]">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          Scanning…
        </div>
      )}
    </div>
  );
}

export default App;
