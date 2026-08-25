import Link from "next/link";
import type { ReactNode } from "react";

import type { LandingCopy } from "./copy";
import { landingSans, landingSerif } from "./fonts";
import { LandingLockup } from "./LandingIdentity";
import { LandingThemeToggle } from "./LandingThemeToggle.client";
import styles from "./landing.module.css";

export function LandingPublicShell({
  copy,
  dataAvailable,
  children,
}: Readonly<{ copy: LandingCopy; dataAvailable: boolean; children: ReactNode }>) {
  return (
    <div
      className={`${styles.shell} ${landingSans.variable} ${landingSerif.variable}`}
      data-design-system="v2"
      data-landing-shell="folded-label-register"
    >
      <a className={styles.skipLink} href="#main-content">
        {copy.skip}
      </a>
      <header className={styles.header}>
        <Link aria-label="TryVit" className={styles.lockupLink} href="/">
          <LandingLockup />
        </Link>
        <p className={styles.identityLabel}>{copy.identityLabel}</p>
        <nav aria-label={copy.navigation.evidence} className={styles.navigation}>
          <a href="#evidence">{copy.navigation.evidence}</a>
          <a href="#method">{copy.navigation.method}</a>
          <a href="#trust">{copy.navigation.trust}</a>
          <Link href="/contact">{copy.navigation.contact}</Link>
          {dataAvailable ? (
            <Link href="/auth/login">{copy.navigation.signIn}</Link>
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
      <main className={styles.main} id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className={styles.footer}>
        <LandingLockup compact />
        <p>{copy.footerStatement}</p>
        <nav aria-label={copy.navigation.trust}>
          <Link href="/learn">{copy.navigation.learn}</Link>
          <Link href="/privacy">{copy.navigation.privacy}</Link>
          <Link href="/terms">{copy.navigation.terms}</Link>
          <Link href="/contact">{copy.navigation.contact}</Link>
          <Link href="/auth/login">{copy.navigation.signIn}</Link>
        </nav>
        <p>{copy.copyright}</p>
      </footer>
    </div>
  );
}
