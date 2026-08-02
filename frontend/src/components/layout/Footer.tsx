"use client";

import { PublicFooter } from "@/components/layout/PublicFooter";
import { useTranslation } from "@/lib/i18n";

/** Localized client wrapper used by existing public content routes. */
export function Footer() {
  const { t } = useTranslation();

  return (
    <PublicFooter
      learnLabel={t("learn.hubTitle")}
      privacyLabel={t("layout.privacy")}
      termsLabel={t("layout.terms")}
      contactLabel={t("layout.contact")}
      copyrightLabel={t("layout.copyright", { year: new Date().getFullYear() })}
    />
  );
}
