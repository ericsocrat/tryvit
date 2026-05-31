"use client";

// ─── Terms of service stub ───────────────────────────────────────────────────

import { LegalPageShell } from "@/components/layout/LegalPageShell";
import { useTranslation } from "@/lib/i18n";

export default function TermsPage() {
  const { t } = useTranslation();
  const sections = [
    [t("legal.acceptance"), t("legal.acceptanceText")],
    [t("legal.serviceDescription"), t("legal.serviceDescText")],
    [t("legal.dataAccuracy"), t("legal.dataAccuracyText")],
    [t("legal.userAccounts"), t("legal.userAccountsText")],
    [t("legal.liability"), t("legal.liabilityText")],
  ] as const;

  return (
    <LegalPageShell
      title={t("legal.termsTitle")}
      intro="The rules for using TryVit, explained in plain language."
      updatedText={t("legal.lastUpdated")}
    >
      {sections.map(([title, description]) => (
        <section
          key={title}
          className="rounded-2xl border border-strong/20 bg-background/80 p-5 shadow-sm dark:bg-white/[0.03] sm:p-6"
        >
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-3 leading-7 text-foreground-secondary">
            {description}
          </p>
        </section>
      ))}

      <section className="rounded-2xl border border-brand/15 bg-brand/5 p-5 shadow-sm dark:bg-brand/10 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {t("legal.contactSection")}
        </h2>
        <p className="mt-3 leading-7 text-foreground-secondary">
          {t("legal.contactText")}
        </p>
      </section>
    </LegalPageShell>
  );
}
