export const THEME_STORAGE_KEY = "theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
export const THEME_MODE_CHANGE_EVENT = "tryvit:theme-mode-change";

export const THEME_CHROME_COLORS = Object.freeze({
  light: "#1DB954",
  dark: "#0A2E1A",
});

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  return prefersDark ? "dark" : "light";
}

export function applyResolvedTheme(resolved: ResolvedTheme, target: Document = document): void {
  const root = target.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  for (const meta of target.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.setAttribute("content", THEME_CHROME_COLORS[resolved]);
  }
}

/**
 * Inline first-paint bootstrap. Keep this dependency-free and synchronous:
 * it executes before React hydration and must also survive blocked storage.
 */
export function createThemeBootstrapScript(): string {
  return `
(function() {
  var mode = 'system';
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (stored === 'light' || stored === 'dark' || stored === 'system') mode = stored;
  } catch (e) {}
  var prefersDark = false;
  try {
    prefersDark = window.matchMedia(${JSON.stringify(THEME_MEDIA_QUERY)}).matches;
  } catch (e) {}
  var resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  var root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  var themeColor = resolved === 'dark' ? ${JSON.stringify(THEME_CHROME_COLORS.dark)} : ${JSON.stringify(THEME_CHROME_COLORS.light)};
  for (var index = 0; index < metas.length; index += 1) metas[index].setAttribute('content', themeColor);
})();
`;
}
