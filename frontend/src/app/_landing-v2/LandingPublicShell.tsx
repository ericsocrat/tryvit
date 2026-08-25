import Link from "next/link";
import type { ReactNode } from "react";

import type { LandingCopy } from "./copy";
import { LandingLockup } from "./LandingIdentity";
import { LandingLiveAuthAction } from "./LandingLiveAuthAction.client";
import { LandingThemeToggle } from "./LandingThemeToggle.client";
import styles from "./landing.module.css";

export function LandingPublicShell({
  copy,
  dataAvailable,
  children,
}: Readonly<{ copy: LandingCopy; dataAvailable: boolean; children: ReactNode }>) {
  return (
    <div
      className={styles.shell}
      data-design-system="v2"
      data-landing-shell="folded-label-register"
    >
      <header className={styles.header}>
        <Link aria-label="TryVit" className={styles.lockupLink} href="/">
          <LandingLockup />
        </Link>
        <p className={styles.identityLabel}>{copy.identityLabel}</p>
        <nav aria-label={copy.primaryNavigationLabel} className={styles.navigation}>
          <a href="#evidence">{copy.navigation.evidence}</a>
          <a href="#method">{copy.navigation.method}</a>
          <a href="#trust">{copy.navigation.trust}</a>
          <Link href="/contact">{copy.navigation.contact}</Link>
          {dataAvailable ? (
            <LandingLiveAuthAction
              dashboardLabel={copy.navigation.dashboard}
              signedOutHref="/auth/login"
              signedOutLabel={copy.navigation.signIn}
            />
          ) : (
            <a href="#service-status">{copy.navigation.statusLink}</a>
          )}
          <LandingThemeToggle
            darkLabel={copy.navigation.darkTheme}
            label={copy.navigation.theme}
            lightLabel={copy.navigation.lightTheme}
          />
        </nav>
      </header>
      <main
        className={styles.main}
        data-route-id="public-landing"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className={styles.footer}>
        <LandingLockup compact />
        <p>{copy.footerStatement}</p>
        <nav aria-label={copy.footerNavigationLabel}>
          <Link href="/learn">{copy.navigation.learn}</Link>
          <Link href="/privacy">{copy.navigation.privacy}</Link>
          <Link href="/terms">{copy.navigation.terms}</Link>
          <Link href="/contact">{copy.navigation.contact}</Link>
          {dataAvailable ? (
            <LandingLiveAuthAction
              dashboardLabel={copy.navigation.dashboard}
              signedOutHref="/auth/login"
              signedOutLabel={copy.navigation.signIn}
            />
          ) : (
            <a href="#service-status">{copy.navigation.statusLink}</a>
          )}
        </nav>
        <p>{copy.copyright}</p>
      </footer>
    </div>
  );
}
