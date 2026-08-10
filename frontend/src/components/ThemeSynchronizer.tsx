"use client";

import { useTheme } from "@/hooks/use-theme";

/** Keeps system-theme changes synchronized even on routes without a toggle. */
export function ThemeSynchronizer() {
  useTheme();
  return null;
}
