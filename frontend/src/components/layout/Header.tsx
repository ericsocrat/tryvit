"use client";

import { ButtonLink } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};
const getMountedSnapshot = () => globalThis.window !== undefined;
const getMountedServerSnapshot = () => false;

export function Header({ dataAvailable = true }: { dataAvailable?: boolean }) {
  const { t } = useTranslation();
  const { resolved, setMode } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );

  useEffect(() => {
    if (!dataAvailable) return;

    let active = true;

    try {
      const client = createClient();

      client.auth.getUser().then(({ data }) => {
        if (active) {
          setIsAuthenticated(!!data.user);
        }
      });

      const onAuthStateChange = client.auth.onAuthStateChange;
      if (typeof onAuthStateChange !== "function") {
        return () => {
          active = false;
        };
      }

      const authListenerResult = onAuthStateChange((_event, session) => {
        if (active) {
          setIsAuthenticated(!!session?.user);
        }
      });

      return () => {
        active = false;
        authListenerResult.data.subscription.unsubscribe();
      };
    } catch {
      return () => {
        active = false;
      };
    }
  }, [dataAvailable]);

  function toggleTheme() {
    setMode(resolved === "dark" ? "light" : "dark");
  }

  let themeLabel = "Toggle theme";
  if (isMounted) {
    themeLabel = resolved === "dark" ? t("theme.light") : t("theme.dark");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-surface/92 shadow-[0_6px_20px_rgba(15,23,42,0.06)] backdrop-blur-sm supports-backdrop-filter:bg-surface/80 dark:border-white/12 dark:bg-surface/92 dark:shadow-[0_6px_24px_rgba(0,0,0,0.3)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" aria-label="TryVit">
          <Logo variant="lockup" size={28} />
        </Link>
        <nav className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface/70 px-2 py-1 sm:gap-3 sm:px-2.5 backdrop-blur-sm">
          <Link
            href="/contact"
            className="touch-target rounded-lg px-2 py-1 text-sm font-medium text-foreground-secondary transition-colors hover:bg-surface-subtle/80 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/45 dark:text-foreground/90 dark:hover:bg-white/10 lg:text-base"
          >
            {t("layout.contact")}
          </Link>
          <button
            onClick={toggleTheme}
            className="touch-target rounded-lg border border-transparent p-2 text-foreground-secondary transition-colors hover:border-border/70 hover:bg-surface-subtle/80 hover:text-foreground focus-visible:border-brand focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/40 dark:text-foreground/90 dark:hover:border-white/20 dark:hover:bg-white/10"
            aria-label={themeLabel}
            title={themeLabel}
          >
            {isMounted && resolved === "dark" ? (
              <Sun size={20} aria-hidden="true" />
            ) : (
              <Moon size={20} aria-hidden="true" />
            )}
          </button>
          <ButtonLink href={dataAvailable ? (isAuthenticated ? "/app" : "/auth/login") : "#service-status"}>
            {dataAvailable
              ? isAuthenticated
                ? t("auth.dashboard")
                : t("auth.signIn")
              : t("landing.demoMode")}
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
