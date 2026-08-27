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
      id="landing-top"
    >
      <header className={styles.header}>
        <a aria-label="TryVit" className={styles.lockupLink} href="#landing-top">
          <LandingLockup />
          <span className={styles.identityLabel} data-landing-market-descriptor>
            {copy.identityLabel}
          </span>
        </a>
        <nav aria-label={copy.primaryNavigationLabel} className={styles.sectionNavigation}>
          <a href="#evidence">{copy.navigation.evidence}</a>
          <a href="#method">{copy.navigation.method}</a>
          <a href="#trust">{copy.navigation.trust}</a>
          <a href="/contact">{copy.navigation.contact}</a>
        </nav>
        <nav aria-label={copy.utilityNavigationLabel} className={styles.utilityNavigation}>
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
          <a href="/learn">{copy.navigation.learn}</a>
          <a href="/privacy">{copy.navigation.privacy}</a>
          <a href="/terms">{copy.navigation.terms}</a>
          <a href="/contact">{copy.navigation.contact}</a>
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
