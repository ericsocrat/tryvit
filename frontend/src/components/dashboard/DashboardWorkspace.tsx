"use client";

import { useTranslation } from "@/lib/i18n";
import { ArrowRight, BookOpen, Camera, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import styles from "./DashboardWorkspace.module.css";

export function DashboardHeader({ displayName, firstUse = false }: Readonly<{ displayName?: string | null; firstUse?: boolean }>) {
  const { t } = useTranslation();
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>{t(firstUse ? "dashboard.newUserTitle" : "dashboard.home.eyebrow")}</p>
        <h1 id="dashboard-title">{firstUse ? t("dashboard.home.firstTitle") : t(displayName ? "dashboard.home.welcomeNamed" : "dashboard.home.welcome", { name: displayName ?? "" })}</h1>
        <p className={styles.subtitle}>{t(firstUse ? "dashboard.home.firstSubtitle" : "dashboard.home.subtitle")}</p>
      </div>
      <Link href="/app/settings" prefetch={false} className={styles.preferences}>
        <SlidersHorizontal size={16} aria-hidden="true" /> <span>{t("dashboard.home.preferences")}</span>
      </Link>
    </header>
  );
}

/** Native GET search works before hydration; camera permission stays in its own flow. */
export function DashboardStart({ firstUse = false }: Readonly<{ firstUse?: boolean }>) {
  const { t } = useTranslation();
  return (
    <section className={styles.start} aria-label={t("dashboard.quickActions")} data-testid="dashboard-start">
      <div className={styles.find}>
        <p className={styles.eyebrow}>{t("dashboard.home.findLabel")}</p>
        <h2>{t("dashboard.home.findTitle")}</h2>
        <form action="/app/search" method="get" role="search" className={styles.searchEntry} data-testid={firstUse ? "new-user-search-cta" : "dashboard-search-cta"}>
          <Search size={20} strokeWidth={1.75} aria-hidden="true" />
          <label className="sr-only" htmlFor="dashboard-product-query">{t("dashboard.home.searchPrompt")}</label>
          <input id="dashboard-product-query" name="q" type="search" required maxLength={200} placeholder={t("dashboard.home.searchPrompt")} autoComplete="off" />
          <button type="submit" aria-label={t("common.search")}><ArrowRight size={20} aria-hidden="true" /></button>
        </form>
        <Link href="/app/categories" prefetch={false} className={styles.browseEntry} data-testid={firstUse ? "new-user-browse-cta" : "dashboard-browse-cta"}>
          {t("dashboard.newUserBrowseTitle")} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <Link href="/app/scan" prefetch={false} className={styles.scan} data-testid={firstUse ? "new-user-scan-cta" : "dashboard-scan-cta"}>
        <div className={styles.scanTop}><Camera size={24} strokeWidth={1.75} aria-hidden="true" /></div>
        <h2>{t("dashboard.newUserScanTitle")}</h2>
        <p>{t("dashboard.home.scanDescription")}</p>
        <span className={styles.scanBottom}>{t("dashboard.home.openScanner")} <ArrowRight size={18} aria-hidden="true" /></span>
      </Link>
    </section>
  );
}

export function DashboardGuide({ firstUse = false }: Readonly<{ firstUse?: boolean }>) {
  const { t } = useTranslation();
  return (
    <section className={styles.guide} aria-labelledby="dashboard-guide-title">
      <div className={styles.guideIntro}>
        <BookOpen size={22} strokeWidth={1.5} aria-hidden="true" />
        <h2 id="dashboard-guide-title">{t("firstUse.guideTitle")}</h2>
        <Link href="/learn" prefetch={false} className={styles.textLink}>{t("firstUse.guideAction")} <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      {firstUse ? (
        <ol className={styles.steps}>
          {(["facts", "evidence", "compare"] as const).map((step, index) => (
            <li key={step}><span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span><h3>{t(`firstUse.${step}Title`)}</h3><p>{t(`firstUse.${step}Description`)}</p></li>
          ))}
        </ol>
      ) : (
        <div className={styles.guideNote}>
          <h3>{t("dashboard.home.evidenceTitle")}</h3><p>{t("dashboard.home.evidenceDescription")}</p>
          <Link href="/learn/confidence" prefetch={false} className={styles.textLink}>{t("dashboard.home.evidenceGuide")} <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      )}
    </section>
  );
}
