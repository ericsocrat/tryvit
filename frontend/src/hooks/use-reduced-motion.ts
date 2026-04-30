"use client";

// ─── useReducedMotion — JS-level reduced motion preference ──────────────────
// Returns true when the user prefers reduced motion.
// CSS already respects this via @media (prefers-reduced-motion: reduce) in
// globals.css; this hook enables JS-driven animations (e.g., Framer Motion,
// scroll-into-view, requestAnimationFrame) to also respect the preference.

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  const mql = globalThis.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return globalThis.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * React hook that tracks the user's `prefers-reduced-motion` media query.
 * Returns `true` when the user prefers reduced motion, `false` otherwise.
 *
 * Safe for SSR — defaults to `false` on the server.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
