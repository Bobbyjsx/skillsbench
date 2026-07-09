export const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Platform-appropriate modifier label: ⌘ on macOS, Ctrl elsewhere. */
export const mod = isMac() ? "⌘" : "Ctrl";

export function shortcutLabel(binding: string): string {
  return binding
    .split("+")
    .map((k) => {
      if (k === "CmdOrCtrl") return mod;
      if (k === "Shift") return "⇧";
      if (k === "Alt") return isMac() ? "⌥" : "Alt";
      if (k === "Meta") return "⌘";
      if (k === "Control") return "Ctrl";
      if (k === "Enter") return "↵";
      if (k === "Escape") return "esc";
      return k;
    })
    .join(" ");
}

export function isCmd(e: KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}
