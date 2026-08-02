"use client";

import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getMountedSnapshot = () => globalThis.window !== undefined;
const getMountedServerSnapshot = () => false;

export function ThemeToggle({
  label,
  lightLabel,
  darkLabel,
}: Readonly<{
  label: string;
  lightLabel: string;
  darkLabel: string;
}>) {
  const { resolved, setMode } = useTheme();
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );
  const accessibleLabel = isMounted ? (resolved === "dark" ? lightLabel : darkLabel) : label;

  return (
    <button
      onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
      className="touch-target rounded-lg border border-transparent p-2 text-foreground-secondary transition-colors hover:border-border/70 hover:bg-surface-subtle/80 hover:text-foreground focus-visible:border-brand focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/40 dark:text-foreground/90 dark:hover:border-white/20 dark:hover:bg-white/10"
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      {isMounted && resolved === "dark" ? (
        <Sun size={20} aria-hidden="true" />
      ) : (
        <Moon size={20} aria-hidden="true" />
      )}
    </button>
  );
}
