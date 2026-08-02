"use client";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { useTranslation } from "@/lib/i18n";

/** Localized client wrapper used by existing public content routes. */
export function Header({ dataAvailable = true }: { dataAvailable?: boolean }) {
  const { t } = useTranslation();

  return (
    <PublicHeader
      dataAvailable={dataAvailable}
      contactLabel={t("layout.contact")}
      signInLabel={t("auth.signIn")}
      dashboardLabel={t("auth.dashboard")}
      demoLabel={t("landing.demoMode")}
      themeLabel={t("theme.label")}
      lightThemeLabel={t("theme.light")}
      darkThemeLabel={t("theme.dark")}
    />
  );
}
