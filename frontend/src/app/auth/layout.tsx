"use client";

import { Logo } from "@/components/common/Logo";
import { useTranslation } from "@/lib/i18n";
import styles from "@/components/auth/AuthExperience.module.css";

export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.shell}>
      <aside className={styles.brandPanel} aria-label={t("auth.brandPanelLabel")}>
        <Logo variant="lockup" size={40} priority className={styles.brandLogo} />
        <div className={styles.brandContent}>
          <p className={styles.brandEyebrow}>{t("auth.brandEyebrow")}</p>
          <h2 className={styles.brandTitle}>{t("auth.brandTitle")}</h2>
          <p className={styles.brandDescription}>{t("auth.marketingBlurb")}</p>
          <div className={styles.brandRegister} aria-label={t("auth.brandRegisterLabel")}>
            <span>{t("auth.brandRegisterSearch")}</span>
            <span>{t("auth.brandRegisterDecode")}</span>
            <span>{t("auth.brandRegisterDecide")}</span>
          </div>
        </div>
        <p className={styles.brandFooter}>{t("auth.brandFooter")}</p>
      </aside>

      <section className={styles.contentPanel} aria-label={t("auth.accountAccessLabel")}>
        <div className={styles.contentInner}>
          <div className={styles.mobileBrand}>
            <Logo variant="lockup" size={32} priority />
            <span className={styles.privateBetaLabel}>{t("auth.privateBetaShort")}</span>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
