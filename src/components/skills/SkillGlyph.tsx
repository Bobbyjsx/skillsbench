import {
  Blocks,
  GitBranch,
  Languages,
  MonitorSmartphone,
  Shapes,
  Terminal,
  TestTube2,
  WandSparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

const KEYWORD_ICONS: [RegExp, LucideIcon][] = [
  [/test|playwright|cypress|vitest|jest|testing/i, TestTube2],
  [/react|vue|svelte|frontend|web|css|tailwind|design|ui|component/i, Shapes],
  [/backend|server|api|database|sql|postgres|redis|graphql|rust|go\b/i, Terminal],
  [/git|github|version|diff/i, GitBranch],
  [/cli|shell|terminal|command|zsh|bash/i, Terminal],
  [/ai|agent|llm|prompt|claude|codex|model/i, WandSparkles],
  [/mobile|ios|android|app/i, MonitorSmartphone],
  [/lang|translate|write|doc|writing/i, Languages],
  [/perf|speed|fast|optim/i, Zap],
];

export function skillIconFor(name: string, description?: string | null): LucideIcon {
  const haystack = `${name} ${description ?? ""}`;
  for (const [re, icon] of KEYWORD_ICONS) {
    if (re.test(haystack)) return icon;
  }
  return Blocks;
}

export function SkillGlyph({
  name,
  description,
  size = "md",
  className,
}: {
  name: string;
  description?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = skillIconFor(name, description);
  const dims =
    size === "sm"
      ? "size-5 rounded-[5px]"
      : size === "lg"
        ? "size-8 rounded-[8px]"
        : "size-6 rounded-[6px]";
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border border-border bg-surface-2 text-faint",
        dims,
        className,
      )}
    >
      <Icon
        className={size === "sm" ? "size-3" : size === "lg" ? "size-4" : "size-3.5"}
        strokeWidth={1.75}
      />
    </span>
  );
}
