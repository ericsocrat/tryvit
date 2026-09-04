"use client";

import { useTranslation } from "@/lib/i18n";
import { ArrowRight, Barcode, BookOpen, Camera, Grid3X3, Search } from "lucide-react";
import Link from "next/link";
import styles from "./NewUserWelcome.module.css";

/** A useful first screen before the user has any product history. */
export function NewUserWelcome() {
  const { t } = useTranslation();
  return (
    <section className={styles.welcome} aria-labelledby="first-use-title" data-testid="new-user-welcome">
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{t("dashboard.newUserTitle")}</p>
        <h1 id="first-use-title">{t("firstUse.title")}</h1>
        <p className={styles.subtitle}>{t("firstUse.subtitle")}</p>
      </header>
      <div className={styles.actions}>
        <article className={styles.scanCard}>
          <div className={styles.scanTop}>
            <span className={styles.scanLabel}>{t("firstUse.startHere")}</span>
            <div className={styles.barcode} aria-hidden="true"><Barcode strokeWidth={1.2} /></div>
          </div>
          <h2>{t("firstUse.scanTitle")}</h2>
          <p>{t("firstUse.scanDescription")}</p>
          <Link href="/app/scan" prefetch={false} className={styles.scanAction} data-testid="new-user-scan-cta">
            <Camera size={19} aria-hidden="true" />
            {t("dashboard.newUserScanTitle")}
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
          <span className={styles.scanHint}>{t("firstUse.scanHint")}</span>
        </article>
        <article className={styles.exploreCard}>
          <Search size={26} strokeWidth={1.5} aria-hidden="true" />
          <h2>{t("firstUse.exploreTitle")}</h2>
          <p>{t("firstUse.exploreDescription")}</p>
          <Link href="/app/search" prefetch={false} className={styles.textAction} data-testid="new-user-search-cta">
            {t("firstUse.searchAction")} <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link href="/app/categories" prefetch={false} className={styles.browseAction} data-testid="new-user-browse-cta">
            <Grid3X3 size={17} aria-hidden="true" /> {t("dashboard.newUserBrowseTitle")}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </article>
      </div>
      <section className={styles.guide} aria-labelledby="first-use-guide">
        <div className={styles.guideHeading}>
          <h2 id="first-use-guide">{t("firstUse.guideTitle")}</h2>
          <Link href="/learn" prefetch={false} className={styles.guideLink}>
            <BookOpen size={16} aria-hidden="true" /> {t("firstUse.guideAction")}
          </Link>
        </div>
        <ol className={styles.steps}>
          {(["facts", "evidence", "compare"] as const).map((step, index) => (
            <li key={step}>
              <span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span>
              <h3>{t(`firstUse.${step}Title`)}</h3>
              <p>{t(`firstUse.${step}Description`)}</p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
