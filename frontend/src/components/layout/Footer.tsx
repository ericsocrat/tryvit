"use client";

import { Logo } from "@/components/common/Logo";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";

export function Footer() {
  const { t } = useTranslation();
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
            {t("learn.hubTitle")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/privacy"
            className="touch-target rounded-md px-2 py-0.5 transition-colors hover:bg-surface-subtle/80 hover:text-foreground"
          >
            {t("layout.privacy")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/terms"
            className="touch-target rounded-md px-2 py-0.5 transition-colors hover:bg-surface-subtle/80 hover:text-foreground"
          >
            {t("layout.terms")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/contact"
            className="touch-target rounded-md px-2 py-0.5 transition-colors hover:bg-surface-subtle/80 hover:text-foreground"
          >
            {t("layout.contact")}
          </Link>
        </div>
        <p className="text-xs sm:text-sm">{t("layout.copyright", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
