// Shared visual metadata for agents and skills.
import type { AgentInfo } from "../types/api";

export const AGENT_META: Record<string, { name: string; short: string }> = {
  claude: { name: "Claude Code", short: "Claude" },
  codex: { name: "Codex", short: "Codex" },
  cursor: { name: "Cursor", short: "Cursor" },
  opencode: { name: "OpenCode", short: "OpenCode" },
  antigravity: { name: "Antigravity", short: "Antigravity" },
  gemini: { name: "Gemini CLI", short: "Gemini" },
  agents: { name: "Agent Skills", short: "Skills" },
};

export function agentMeta(id: string): { name: string; short: string } {
  return AGENT_META[id] ?? { name: id, short: id };
}

/** Stable display order: shared ancestors first, then CLIs, then IDEs. */
export const AGENT_ORDER = [
  "agents",
  "claude",
  "codex",
  "opencode",
  "gemini",
  "cursor",
  "antigravity",
];

export function orderedAgents<T extends { id: string }>(agents: T[]): T[] {
  const rank = new Map(AGENT_ORDER.map((id, i) => [id, i]));
  return [...agents].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99));
}

export function agentShort(id: string): string {
  return agentMeta(id).short;
}

/** The detected agents that are actually usable, ancestors first. */
export function detectedAgents(agents: AgentInfo[]): AgentInfo[] {
  return agents.filter((a) => a.detected);
}

export function isAgentUsable(a: AgentInfo): boolean {
  return a.binary || a.kind === "shared";
}
