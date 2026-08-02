import { Logo } from "@/components/common/Logo";
import Link from "next/link";

interface PublicFooterProps {
  readonly learnLabel: string;
  readonly privacyLabel: string;
  readonly termsLabel: string;
  readonly contactLabel: string;
  readonly copyrightLabel: string;
}

/** Presentational footer that can render entirely on the server. */
export function PublicFooter({
  learnLabel,
  privacyLabel,
  termsLabel,
  contactLabel,
  copyrightLabel,
}: PublicFooterProps) {
  return (
    <footer className="border-t border-border/70 bg-surface/85 py-8 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 text-center text-sm text-foreground-secondary">
        <div className="mb-4 flex justify-center">
          <Logo variant="lockup" size={24} />
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-center gap-1 rounded-xl border border-border/60 bg-surface/70 px-2 py-1.5 backdrop-blur-sm sm:gap-2">
          <Link
            href="/learn"
            className="touch-target rounded-md px-2 py-0.5 transition-colors hover:bg-surface-subtle/80 hover:text-foreground"
          >
            {learnLabel}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/privacy"
            className="touch-target rounded-md px-2 py-0.5 transition-colors hover:bg-surface-subtle/80 hover:text-foreground"
          >
            {privacyLabel}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/terms"
            className="touch-target rounded-md px-2 py-0.5 transition-colors hover:bg-surface-subtle/80 hover:text-foreground"
          >
            {termsLabel}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/contact"
            className="touch-target rounded-md px-2 py-0.5 transition-colors hover:bg-surface-subtle/80 hover:text-foreground"
          >
            {contactLabel}
          </Link>
        </div>
        <p className="text-xs sm:text-sm">{copyrightLabel}</p>
      </div>
    </footer>
  );
}
