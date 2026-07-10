import type { AppSettings } from "../types/api";

export type Theme = "system" | "light" | "dark";

let media: MediaQueryList | null = null;

function preferred(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  media ??= window.matchMedia("(prefers-color-scheme: light)");
  return media.matches ? "light" : "dark";
}

export function applyTheme(settings: Pick<AppSettings, "theme">) {
  const resolved = settings.theme === "system" ? preferred() : settings.theme;
  document.documentElement.dataset.theme = resolved;
}

export function watchSystemTheme(cb: () => void): () => void {
  media ??= window.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => cb();
  media.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}
