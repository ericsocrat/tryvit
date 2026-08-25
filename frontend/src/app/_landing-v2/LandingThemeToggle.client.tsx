"use client";

import { useTheme } from "@/hooks/use-theme";
import { useSyncExternalStore } from "react";

import styles from "./landing.module.css";

const emptySubscribe = () => () => {};
const getMountedSnapshot = () => globalThis.window !== undefined;
const getMountedServerSnapshot = () => false;

export function LandingThemeToggle({
  label,
  lightLabel,
  darkLabel,
}: Readonly<{ label: string; lightLabel: string; darkLabel: string }>) {
  const { resolved, setMode } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );
  const nextLabel = mounted ? (resolved === "dark" ? lightLabel : darkLabel) : label;

  return (
    <button
      aria-label={nextLabel}
      className={styles.themeToggle}
      onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
      title={nextLabel}
      type="button"
    >
      <span
        aria-hidden="true"
        className={styles.themeGlyph}
        data-mode={mounted && resolved === "dark" ? "dark" : "light"}
      />
      <span className={styles.visuallyHidden}>{nextLabel}</span>
    </button>
  );
}
