"use client";

/**
 * useInstallPrompt — centralises PWA install-prompt logic.
 *
 * Responsibilities:
 *  - Capture the browser's `beforeinstallprompt` event (Chrome/Edge/Samsung)
 *  - Detect standalone mode (already installed)
 *  - Detect iOS Safari (no native prompt – manual instructions instead)
 *  - Track visits via localStorage, gating the banner on ≥ 2 visits
 *  - 30-day dismiss cooldown
 *  - Track `appinstalled` event
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/* ── Public type re-export ─────────────────────────────────────────────────── */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* ── Constants (exported for tests) ────────────────────────────────────────── */
export const STORAGE_KEY_DISMISSED = "pwa-install-dismissed-at";
export const STORAGE_KEY_VISITS = "pwa-install-visit-count";
export const STORAGE_KEY_INSTALLED = "pwa-installed";
export const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MIN_VISITS_FOR_BANNER = 2;

/* ── Pure helpers (exported for direct use + tests) ────────────────────────── */

/** True while the 30-day dismiss cooldown is still active. */
export function isDismissCooldownActive(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/** Increment visit counter and return the new count. */
export function incrementVisitCount(): number {
  try {
    const current = Number(localStorage.getItem(STORAGE_KEY_VISITS) ?? "0");
    const next = current + 1;
    localStorage.setItem(STORAGE_KEY_VISITS, String(next));
    return next;
  } catch {
    return 1;
  }
}

/** Read the current visit count without incrementing. */
export function getVisitCount(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY_VISITS) ?? "0");
  } catch {
    return 0;
  }
}

/** Detect iOS Safari (no `beforeinstallprompt`, manual instructions needed). */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)
  );
}

/** True if app is running in standalone / installed mode. */
export function isStandalone(): boolean {
  if (typeof globalThis.matchMedia !== "function") return false;
  return globalThis.matchMedia("(display-mode: standalone)").matches;
}

/** Record that the PWA was installed. */
export function markInstalled(): void {
  try {
    localStorage.setItem(STORAGE_KEY_INSTALLED, String(Date.now()));
  } catch {
    /* quota exceeded — ignore */
  }
}

/** Record that the user dismissed the banner. */
export function markDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY_DISMISSED, String(Date.now()));
  } catch {
    /* quota exceeded — ignore */
  }
}

/* ── useSyncExternalStore helpers for `isInstalled` ────────────────────────
   `isInstalled` is derived from two SSR-unsafe sources (matchMedia +
   localStorage). Using `useSyncExternalStore` avoids the React-Compiler
   `set-state-in-effect` violation and is hydration-safe: `getServerSnapshot`
   returns `false`, matching the initial client snapshot when the page is
   neither standalone nor previously installed.
*/
function subscribeInstalled(notify: () => void): () => void {
  if (typeof globalThis.addEventListener !== "function") return () => {};
  const handler = () => {
    // Persist the installed flag *before* React re-reads the snapshot so
    // `getInstalledSnapshot` returns `true` on the next render.
    markInstalled();
    notify();
  };
  globalThis.addEventListener("appinstalled", handler);
  return () => globalThis.removeEventListener("appinstalled", handler);
}

function getInstalledSnapshot(): boolean {
  if (isStandalone()) return true;
  try {
    return (
      typeof localStorage !== "undefined" &&
      !!localStorage.getItem(STORAGE_KEY_INSTALLED)
    );
  } catch {
    return false;
  }
}

function getInstalledServerSnapshot(): boolean {
  return false;
}

/* ── Module-level emitters for `dismissed` + `enoughVisits` ───────────────
   These pieces of state derive from localStorage and transition only via
   in-hook side-effects (mount visit-increment and the `dismiss()` callback).
   A lightweight EventTarget lets `useSyncExternalStore` re-snapshot when those
   side-effects fire, avoiding `set-state-in-effect`.
*/
const dismissEmitter =
  typeof EventTarget !== "undefined" ? new EventTarget() : null;
const visitsEmitter =
  typeof EventTarget !== "undefined" ? new EventTarget() : null;

function notifyDismissed(): void {
  dismissEmitter?.dispatchEvent(new Event("change"));
}
function notifyVisits(): void {
  visitsEmitter?.dispatchEvent(new Event("change"));
}

function subscribeDismissed(cb: () => void): () => void {
  if (!dismissEmitter) return () => {};
  dismissEmitter.addEventListener("change", cb);
  return () => dismissEmitter.removeEventListener("change", cb);
}
function getDismissedSnapshot(): boolean {
  return isDismissCooldownActive();
}
function getDismissedServerSnapshot(): boolean {
  return false;
}

function subscribeVisits(cb: () => void): () => void {
  if (!visitsEmitter) return () => {};
  visitsEmitter.addEventListener("change", cb);
  return () => visitsEmitter.removeEventListener("change", cb);
}
function getEnoughVisitsSnapshot(): boolean {
  return getVisitCount() >= MIN_VISITS_FOR_BANNER;
}
function getEnoughVisitsServerSnapshot(): boolean {
  return false;
}

const emptySubscribe = (): (() => void) => () => {};
function getIOSSnapshot(): boolean {
  return isIOSDevice();
}
function getIOSServerSnapshot(): boolean {
  return false;
}

/* ── Hook return type ──────────────────────────────────────────────────────── */
export interface UseInstallPromptReturn {
  /** The deferred browser prompt — null when not available. */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** True when the device is iOS (show manual instructions). */
  isIOS: boolean;
  /** True when the PWA is already installed as standalone. */
  isInstalled: boolean;
  /** True when the install banner should be visible. */
  canShowBanner: boolean;
  /** Trigger the native install prompt (Android/Desktop). */
  triggerInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  /** Dismiss the banner (sets 30-day cooldown). */
  dismiss: () => void;
}

/* ── Hook ──────────────────────────────────────────────────────────────────── */

export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // All four mount-derived booleans are sourced from external stores. This
  // avoids `set-state-in-effect` and is hydration-safe — every server
  // snapshot returns `false`, matching the initial client snapshot before any
  // side-effects run.
  const isInstalled = useSyncExternalStore(
    subscribeInstalled,
    getInstalledSnapshot,
    getInstalledServerSnapshot,
  );
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    getDismissedSnapshot,
    getDismissedServerSnapshot,
  );
  const enoughVisits = useSyncExternalStore(
    subscribeVisits,
    getEnoughVisitsSnapshot,
    getEnoughVisitsServerSnapshot,
  );
  const isIOS = useSyncExternalStore(
    emptySubscribe,
    getIOSSnapshot,
    getIOSServerSnapshot,
  );

  useEffect(() => {
    // Already installed or cooldown active — no listeners or visit-tracking.
    if (getInstalledSnapshot()) return;
    if (isDismissCooldownActive()) return;

    // Increment visit count on mount, then notify subscribers so the
    // `enoughVisits` snapshot reflects the new count.
    incrementVisitCount();
    notifyVisits();

    // Listen for beforeinstallprompt (Chromium browsers)
    const bipHandler = (e: Event) => {
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      promptRef.current = bip;
      setDeferredPrompt(bip);
    };
    globalThis.addEventListener("beforeinstallprompt", bipHandler);

    // Clear the deferred prompt when the PWA is installed. The store
    // subscriber handles `markInstalled()` + the `isInstalled` update.
    const installedHandler = () => {
      setDeferredPrompt(null);
      promptRef.current = null;
    };
    globalThis.addEventListener("appinstalled", installedHandler);

    return () => {
      globalThis.removeEventListener("beforeinstallprompt", bipHandler);
      globalThis.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    const prompt = promptRef.current;
    if (!prompt) return "unavailable";
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      promptRef.current = null;
    }
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    markDismissed();
    notifyDismissed();
    setDeferredPrompt(null);
    promptRef.current = null;
  }, []);

  const canShowBanner =
    !isInstalled &&
    !dismissed &&
    enoughVisits &&
    (!!deferredPrompt || isIOS);

  return {
    deferredPrompt,
    isIOS,
    isInstalled,
    canShowBanner,
    triggerInstall,
    dismiss,
  };
}
