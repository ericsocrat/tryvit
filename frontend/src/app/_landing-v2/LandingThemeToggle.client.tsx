"use client";

import { useTheme } from "@/hooks/use-theme";

import styles from "./landing.module.css";

export function LandingThemeToggle({
  label,
  lightLabel,
  darkLabel,
}: Readonly<{ label: string; lightLabel: string; darkLabel: string }>) {
  const { resolved, setMode } = useTheme();

  return (
    <>
      <button
        className={`${styles.themeToggle} ${styles.themeToggleInteractive}`}
        onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
        title={label}
        type="button"
      >
        <span aria-hidden="true" className={styles.themeGlyph} />
        <span className={`${styles.visuallyHidden} ${styles.themeLightAction}`}>{darkLabel}</span>
        <span className={`${styles.visuallyHidden} ${styles.themeDarkAction}`}>{lightLabel}</span>
      </button>
      <noscript>
        <button
          aria-label={label}
          className={styles.themeToggle}
          disabled
          title={label}
          type="button"
        >
          <span aria-hidden="true" className={styles.themeGlyph} />
        </button>
      </noscript>
    </>
  );
}
