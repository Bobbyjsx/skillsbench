import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCw,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SkillGlyph } from "../skills/SkillGlyph";
import { useSkills } from "../../stores/skills";
import { api } from "../../api/client";
import { toast } from "../../stores/toasts";
import { compactNumber, timeAgo } from "../../lib/format";
import { cn } from "../../lib/cn";
import type { MarketSkill } from "../../types/api";

const POPULAR = ["gsap", "nextjs", "claude", "github", "figma", "shadcn"];

type BrowseState = "loading" | "loaded" | "offline" | "stale";

export function MarketplacePage() {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MarketSkill[]>([]);
  const [searchDone, setSearchDone] = useState(false);
  const [browse, setBrowse] = useState<MarketSkill[]>([]);
  const [browseState, setBrowseState] = useState<BrowseState>("loading");
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [lanes, setLanes] = useState(window.innerWidth >= 640 ? 2 : 1);
  const [page, setPage] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const installedNames = useRef(new Set(useSkills.getState().items.map((i) => i.name)));

  useEffect(() => {
    const sub = useSkills.subscribe((s) => {
      installedNames.current = new Set(s.items.map((i) => i.name));
    });
    return sub;
  }, []);

  const loadCatalog = async () => {
    setBrowseState("loading");
    try {
      const cat = await api.marketCatalog();
      setBrowse(cat.items);
      setRefreshedAt(cat.refreshedAtMs);
      setBrowseState(cat.items.length > 0 ? "loaded" : "offline");
    } catch (e) {
      api.logLine(`catalog failed: ${String(e)}`);
      setBrowse([]);
      setBrowseState("offline");
    }
  };

  useEffect(() => {
    loadCatalog();
    const onResize = () => setLanes(window.innerWidth >= 640 ? 2 : 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const refreshCatalog = async () => {
    setBrowseState("loading");
    try {
      const cat = await api.marketCatalog(true);
      setBrowse(cat.items);
      setRefreshedAt(cat.refreshedAtMs);
      setBrowseState(cat.items.length > 0 ? "loaded" : "offline");
    } catch {
      setBrowseState((prev) => (prev === "loading" ? "offline" : prev));
    }
  };

  const search = async (q: string) => {
    const query = q.trim();
    if (!query) {
      setSearching(false);
      setSearchResults([]);
      setSearchDone(false);
      return;
    }
    setSearching(true);
    setSearchDone(false);
    try {
      const hits = await api.marketSearch(query, 24);
      setSearchResults(hits);
      setSearchDone(true);
    } catch (e) {
      api.logLine(`market search failed: ${String(e)}`);
      setSearchResults([]);
      setSearchDone(true);
    } finally {
      setSearching(false);
    }
  };

  const onInput = (v: string) => {
    setInputValue(v);
    setPage(1);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setQuery(v);
      search(v);
    }, 350);
  };

  const copyInstall = (s: MarketSkill) => {
    navigator.clipboard?.writeText(`npx skills add ${s.skillId}`);
    toast.success("Command copied", `npx skills add ${s.skillId}`);
  };

  const openPage = async (s: MarketSkill) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      const segs = s.id.split("/").slice(0, 3);
      await openUrl(`https://www.skills.sh/${segs.join("/")}`);
    } catch {
      toast.error("Couldn't open the skill page");
    }
  };

  const browsing = !query.trim();
  const list: MarketSkill[] = browsing ? browse : searchResults;
  const ITEMS_PER_PAGE = 30;
  const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
  const paginatedList = list.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="h-full overflow-y-auto" ref={rootRef}>
      <div className="mx-auto max-w-[820px] px-8 py-10">
        <div className="flex items-center gap-2">
          <Compass className="size-4 text-accent" />
          <h2 className="text-xl font-semibold tracking-tight text-text">Marketplace</h2>
          <span className="rounded-[4px] bg-hover px-1.5 py-0.5 text-2xs font-medium text-faint">
            skills.sh
          </span>
          {refreshedAt && (
            <span className="ml-auto flex items-center gap-1 text-2xs text-faint">
              <RefreshCw className="size-2.5" />
              updated {timeAgo(refreshedAt)}
            </span>
          )}
          <Button variant="ghost" size="xs" onClick={refreshCatalog} title="Refresh catalog">
            <RotateCw className="size-3" />
            Refresh
          </Button>
        </div>
        <p className="mt-2 max-w-[540px] text-sm leading-relaxed text-muted">
          Browse the most popular agent skills first. {">"}600,000 indexed from the open-source
          ecosystem — counts are anonymous installs collected by the skills CLI.
        </p>

        <div className="mt-6 max-w-[420px]">
          <Input
            value={inputValue}
            onChange={(e) => onInput(e.target.value)}
            placeholder="Filter the catalog by name…"
            leftIcon={<Search className="size-3.5" />}
            helpText={searching ? "Searching skills.sh…" : undefined}
          />
          {browsing && !searching && (
            <div className="mt-2 flex items-center gap-1.5 text-2xs text-faint">
              <span>Try</span>
              {POPULAR.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setQuery(p);
                    setInputValue(p);
                    setPage(1);
                    search(p);
                  }}
                  className="rounded-[4px] bg-surface-2 px-1.5 py-0.5 text-muted transition-colors hover:bg-active hover:text-text"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 min-h-[200px]">
          {/* catalog states */}
          {browsing && browseState === "loading" && (
            <div className="flex flex-col items-center gap-2 rounded-[8px] border border-border bg-surface px-6 py-12 text-center">
              <Loader2 className="size-4 animate-spin text-accent" />
              <div className="text-sm text-muted">Loading the catalog…</div>
              <div className="text-2xs text-faint">Pulling the latest rankings from skills.sh.</div>
            </div>
          )}

          {browsing && browseState === "offline" && (
            <div className="flex flex-col items-center gap-2 rounded-[8px] border border-border bg-surface px-6 py-12 text-center">
              <WifiOff className="size-5 text-warning" />
              <div className="text-sm font-medium text-text">Couldn't reach skills.sh</div>
              <div className="max-w-[380px] text-xs leading-relaxed text-muted">
                The catalog needs a network connection. Check that you're online, then try again.
              </div>
              <Button variant="subtle" size="sm" className="mt-2" onClick={refreshCatalog}>
                <RotateCw className="size-3" />
                Try again
              </Button>
            </div>
          )}

          {(browsing ? list.length > 0 : searchResults.length > 0 || searching || searchDone) && (
            <div className={cn("grid gap-4", lanes === 2 ? "grid-cols-2" : "grid-cols-1")}>
              {paginatedList.map((s) => (
                <SkillCard
                  key={s.id}
                  skill={s}
                  installed={installedNames.current.has(s.name)}
                  onCopy={copyInstall}
                  onOpen={openPage}
                />
              ))}
            </div>
          )}

          {!browsing && !searching && searchDone && list.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 rounded-[8px] border border-dashed border-border px-6 py-12 text-center">
              <Search className="size-5 text-faint" />
              <div className="text-sm text-muted">Nothing matches "{query}"</div>
              <div className="text-2xs text-faint">
                Try a different term, or clear the search to browse again.
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-8 mb-10 flex items-center justify-center gap-4">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="size-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm font-medium text-muted">
                Page {page} of {totalPages}
              </div>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  installed,
  onCopy,
  onOpen,
}: {
  skill: MarketSkill;
  installed: boolean;
  onCopy: (s: MarketSkill) => void;
  onOpen: (s: MarketSkill) => void;
}) {
  return (
    <div className="group flex items-start gap-3 rounded-[8px] border border-border bg-surface p-3.5 transition-colors hover:border-border-strong">
      <SkillGlyph name={skill.name} description="" size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text">{skill.name}</span>
          {skill.isOfficial && (
            <span title="Official skill" className="text-accent">
              <BadgeCheck className="size-3.5" />
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-2xs text-faint">
          <span className="truncate">{skill.source}</span>
          <span className="shrink-0 tabular">{compactNumber(skill.installs)} installs</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          {installed ? (
            <span className="flex items-center gap-1 text-2xs font-medium text-success">
              <Check className="size-3" /> Installed locally
            </span>
          ) : (
            <Button
              size="xs"
              variant="subtle"
              onClick={() => onCopy(skill)}
              title="Copy the install command"
            >
              <Copy className="size-3" />
              Copy install
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={() => onOpen(skill)} title="Open on skills.sh">
            <ExternalLink className="size-3" />
            View on skills.sh
          </Button>
        </div>
      </div>
      {!installed && (
        <span
          className={cn(
            "mt-0.5 shrink-0 text-2xs text-faint opacity-0 transition-opacity group-hover:opacity-100",
          )}
        >
          install via CLI
          <ArrowRight className="ml-1 inline size-3" />
        </span>
      )}
    </div>
  );
}
