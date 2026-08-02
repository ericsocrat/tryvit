import { ButtonLink } from "@/components/common/Button";
import { LiveHeaderAuthAction } from "@/components/layout/LivePublicAuthActions";
import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import Link from "next/link";

interface PublicHeaderProps {
  readonly dataAvailable: boolean;
  readonly contactLabel: string;
  readonly signInLabel: string;
  readonly dashboardLabel: string;
  readonly demoLabel: string;
  readonly themeLabel: string;
  readonly lightThemeLabel: string;
  readonly darkThemeLabel: string;
}

/** Server-compatible public header with one narrowly scoped theme client island. */
export function PublicHeader({
  dataAvailable,
  contactLabel,
  signInLabel,
  dashboardLabel,
  demoLabel,
  themeLabel,
  lightThemeLabel,
  darkThemeLabel,
}: PublicHeaderProps) {
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
            {contactLabel}
          </Link>
          <ThemeToggle label={themeLabel} lightLabel={lightThemeLabel} darkLabel={darkThemeLabel} />
          {dataAvailable ? (
            <LiveHeaderAuthAction signInLabel={signInLabel} dashboardLabel={dashboardLabel} />
          ) : (
            <ButtonLink href="#service-status">{demoLabel}</ButtonLink>
          )}
        </nav>
      </div>
    </header>
  );
}
