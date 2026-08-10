import {
  Blocks,
  Boxes,
  FolderKanban,
  FolderOpen,
  Globe,
  Home,
  Layers,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useApp, type Screen } from "../../stores/app";
import { cn } from "../../lib/cn";
import { mod } from "../../lib/keys";
import { Kbd } from "../ui/Misc";
import { Tooltip } from "../ui/Misc";

interface NavItem {
  id: Screen;
  label: string;
  icon: LucideIcon;
  kbd?: string;
  count?: number;
}

function SidebarInner() {
  const { screen, setScreen, counts, sidebarCollapsed } = useApp();

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Skills",
      items: [
        { id: "overview", label: "Overview", icon: Home, kbd: `${mod}1` },
        { id: "skills", label: "All Skills", icon: Blocks, kbd: `${mod}2`, count: counts.skills },
        { id: "marketplace", label: "Discover", icon: Globe, kbd: `${mod}3` },
      ],
    },
    {
      label: "Organize",
      items: [
        { id: "groups", label: "Groups", icon: Layers, count: counts.groups },
        { id: "projects", label: "Projects", icon: FolderKanban, count: counts.projects },
      ],
    },
    {
      label: "System",
      items: [
        { id: "agents", label: "Agents", icon: Users, count: counts.agents },
        { id: "settings", label: "Settings", icon: Settings },
      ],
    },
  ];

  if (sidebarCollapsed) {
    return (
      <nav className="flex w-[46px] flex-col items-center gap-0.5 py-2" aria-label="Main">
        {groups.map((g) =>
          g.items.map((item) => {
            const Icon = item.icon;
            const active = screen === item.id;
            const attention = item.id === "skills" && counts.modified + counts.broken > 0;
            return (
              <Tooltip key={item.id} label={item.label}>
                <button
                  onClick={() => setScreen(item.id)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-[7px] transition-colors duration-120 ease-app",
                    active ? "bg-active text-text" : "text-muted hover:bg-hover hover:text-text",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {attention && (
                    <span className="absolute right-1 top-1 size-1.5 rounded-full bg-warning" />
                  )}
                </button>
              </Tooltip>
            );
          }),
        )}
      </nav>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Main">
      {groups.map((g) => (
        <div key={g.label} className="mb-4 last:mb-0">
          <div className="px-2 pb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-faint select-none">
            {g.label}
          </div>
          <div className="space-y-px">
            {g.items.map((item) => {
              const Icon = item.icon;
              const active = screen === item.id;
              const attention = item.id === "skills" && counts.modified + counts.broken > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-[6px] px-2 py-[5px] text-sm transition-colors duration-120 ease-app select-none",
                    active ? "bg-active text-text" : "text-muted hover:bg-hover hover:text-text",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      active ? "text-text" : "text-faint group-hover:text-muted",
                    )}
                    strokeWidth={1.75}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {attention && <span className="size-1.5 rounded-full bg-warning" />}
                  {item.count != null && item.count > 0 && (
                    <span className="tabular text-2xs text-faint group-hover:text-muted">
                      {item.count}
                    </span>
                  )}
                  {item.kbd && (
                    <Kbd className="opacity-0 transition-opacity duration-120 group-hover:opacity-100">
                      {item.kbd}
                    </Kbd>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const app = useApp();
  const { sidebarCollapsed, toggleSidebar } = app;

  return (
    <>
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-bg transition-[width] duration-200 ease-app",
          "fixed inset-y-0 left-0 z-40 md:relative md:flex",
          sidebarCollapsed ? "w-[46px]" : "w-[218px]",
          !useApp().mobileSidebarOpen && "hidden",
        )}
        aria-label="Sidebar"
      >
        <div
          className={cn(
            "flex items-center gap-1.5 px-3 pb-1 pt-3 select-none",
            sidebarCollapsed && "justify-center px-0",
          )}
        >
          {!sidebarCollapsed && (
            <>
              <span className="flex size-5 items-center justify-center rounded-[6px] bg-accent-soft">
                <Boxes className="size-3 text-accent" strokeWidth={2} />
              </span>
              <span className="text-md font-semibold tracking-tight text-text">Skillbench</span>
              <span className="mt-0.5 ml-auto text-2xs text-faint">v0.1</span>
            </>
          )}
          {sidebarCollapsed && (
            <span className="flex size-5 items-center justify-center rounded-[6px] bg-accent-soft">
              <Boxes className="size-3 text-accent" strokeWidth={2} />
            </span>
          )}
        </div>

        <SidebarInner />

        <div
          className={cn(
            "flex items-center border-t border-border px-2 py-2",
            sidebarCollapsed && "justify-center",
          )}
        >
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-6 items-center justify-center rounded-[6px] text-faint transition-colors duration-120",
              "hover:bg-hover hover:text-muted",
              sidebarCollapsed ? "w-6" : "w-full gap-1.5",
            )}
          >
            {sidebarCollapsed ? (
              <FolderOpen className="size-3.5" />
            ) : (
              <>
                <FolderOpen className="size-3.5" />
                <span className="text-2xs font-medium">Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
      {app.mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden animate-fade-in"
          onClick={() => app.setMobileSidebar(false)}
          aria-label="Close sidebar overlay"
        />
      )}
    </>
  );
}
