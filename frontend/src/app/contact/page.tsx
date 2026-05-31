"use client";

// ─── Contact page stub ──────────────────────────────────────────────────────

import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { useTranslation } from "@/lib/i18n";

export default function ContactPage() {
  const { t } = useTranslation();
  return (
    <LegalPageShell
      title={t("legal.contactTitle")}
      intro={t("legal.contactIntro")}
      updatedText={t("legal.responseTime")}
    >
      <section className="rounded-2xl border border-strong/20 bg-background/80 p-5 shadow-sm dark:bg-white/[0.03] sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
          {t("legal.emailLabel")}
        </p>
        <a
          href="mailto:hello@example.com"
          className="mt-3 inline-flex text-base font-medium text-brand underline decoration-brand/30 underline-offset-4 transition-colors hover:text-brand/80"
        >
          hello@example.com
        </a>
      </section>
    </LegalPageShell>
  );
}
