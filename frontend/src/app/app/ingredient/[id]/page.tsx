"use client";

import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";

/** Preserve old bookmarks without republishing unsupported ingredient risk grades. */
export default function IngredientProfilePage() {
  const { t } = useTranslation();
  return <AppPage>
    <Breadcrumbs items={[{ labelKey: "nav.home", href: "/app" }, { labelKey: "nav.find", href: "/app/search" }]} />
    <AppPageHeader eyebrow={t("nav.learn")} title={t("evidenceLearn.ingredientNoticeTitle")} description={t("evidenceLearn.ingredientNoticeText")} />
    <Link href="/learn/additives" className="inline-flex min-h-11 items-center text-brand underline underline-offset-4">{t("evidenceLearn.ingredientNoticeLink")}</Link>
  </AppPage>;
}
