// ─── useTheme — 3-mode theme hook (light / dark / system) ───────────────────
// Reads/writes theme preference to localStorage.
// Applies the resolved theme (light or dark) to `data-theme` on <html>.
// Listens to prefers-color-scheme media query when mode = 'system'.
//
// For authenticated users, the preference can be synced to user_preferences
// via the Settings page save flow (not handled here — this is the client-only
// primitive that the ThemeToggle component and Settings sync build on).

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyResolvedTheme,
  isThemeMode,
  resolveThemeMode,
  THEME_MEDIA_QUERY,
  THEME_MODE_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeMode,
} from "@/design-system/accessibility/theme-contract";

export type { ResolvedTheme, ThemeMode } from "@/design-system/accessibility/theme-contract";

/** Read the persisted theme mode from localStorage. */
function getStoredTheme(): ThemeMode {
  if (globalThis.window === undefined) return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(stored)) return stored;
  } catch {
    // localStorage blocked (e.g. Safari private browsing)
  }
  return "system";
}

/** Resolve the actual theme (light or dark) from a mode. */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  const prefersDark =
    globalThis.window !== undefined && globalThis.matchMedia(THEME_MEDIA_QUERY).matches;
  return resolveThemeMode(mode, prefersDark);
}

/** Apply the resolved theme to the document. */
function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  applyResolvedTheme(resolved);
}

/**
 * Custom hook for theme management.
 *
 * @returns `{ mode, resolved, setMode }` where:
 *  - `mode` is the user's chosen preference ('light' | 'dark' | 'system')
 *  - `resolved` is the actual applied theme ('light' | 'dark')
 *  - `setMode` changes the preference and persists it
 *
 * @example
 * ```tsx
 * const { mode, resolved, setMode } = useTheme();
 * <button onClick={() => setMode('dark')}>Dark</button>
 * ```
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(mode),
  );

  const updateMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch {
      // localStorage unavailable
    }
    const newResolved = resolveTheme(newMode);
    setResolved(newResolved);
    applyTheme(newResolved);
    globalThis.dispatchEvent(
      new CustomEvent<ThemeMode>(THEME_MODE_CHANGE_EVENT, { detail: newMode }),
    );
  }, []);

  // Keep independent hook consumers coherent in the current document and
  // across tabs. A same-window custom event is required because browsers do
  // not dispatch `storage` back to the tab that performed the write.
  useEffect(() => {
    const synchronizeMode = (nextMode: ThemeMode) => {
      const nextResolved = resolveTheme(nextMode);
      setMode(nextMode);
      setResolved(nextResolved);
      applyTheme(nextResolved);
    };
    const handleModeChange = (event: Event) => {
      if (event instanceof CustomEvent && isThemeMode(event.detail)) {
        synchronizeMode(event.detail);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        synchronizeMode(getStoredTheme());
      }
    };

    globalThis.addEventListener(THEME_MODE_CHANGE_EVENT, handleModeChange);
    globalThis.addEventListener("storage", handleStorage);
    return () => {
      globalThis.removeEventListener(THEME_MODE_CHANGE_EVENT, handleModeChange);
      globalThis.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Listen to system preference changes when mode = 'system'
  useEffect(() => {
    if (mode !== "system") return;

    const mql = globalThis.matchMedia(THEME_MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? "dark" : "light";
      setResolved(newResolved);
      applyTheme(newResolved);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  // On mount, ensure the DOM attribute matches (in case the inline script
  // didn't run or hydration reset it)
  useEffect(() => {
    applyTheme(resolved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(
    () => ({ mode, resolved, setMode: updateMode }),
    [mode, resolved, updateMode],
  );
}
