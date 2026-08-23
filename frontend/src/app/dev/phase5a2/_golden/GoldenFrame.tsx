import type { ReactNode } from "react";

import {
  PHASE5A2_GOLDEN_REFERENCES,
  goldenReferenceHref,
  type GoldenRouteState,
} from "./contract";
import { GoldenLockup } from "./GoldenIdentity";
import styles from "./golden.module.css";

const REFERENCE_LABELS = Object.freeze({
  en: {
    landing: "Landing",
    authentication: "Authentication",
    home: "Home",
    search: "Search",
    product: "Product evidence",
    scanner: "Scanner",
    review: "Non-production Golden Reference review",
    synthetic: "Deterministic synthetic evidence. No camera, account, or external product service is active.",
    skip: "Skip to reference",
    locale: "Language",
    theme: "Theme",
    motion: "Motion",
    full: "Full",
    reduced: "Reduced",
    light: "Light",
    dark: "Dark",
  },
  pl: {
    landing: "Strona główna",
    authentication: "Logowanie",
    home: "Panel główny",
    search: "Wyszukiwanie",
    product: "Produkt i dane",
    scanner: "Skaner",
    review: "Nieprodukcyjny przegląd Golden Reference",
    synthetic: "Deterministyczne dane syntetyczne. Aparat, konto i zewnętrzne usługi produktów są nieaktywne.",
    skip: "Przejdź do widoku",
    locale: "Język",
    theme: "Motyw",
    motion: "Ruch",
    full: "Pełny",
    reduced: "Ograniczony",
    light: "Jasny",
    dark: "Ciemny",
  },
  de: {
    landing: "Startseite",
    authentication: "Anmeldung",
    home: "Übersicht",
    search: "Suche",
    product: "Produkt und Evidenz",
    scanner: "Scanner",
    review: "Nicht produktive Golden-Reference-Prüfung",
    synthetic: "Deterministische synthetische Daten. Kamera, Konto und externe Produktdienste sind nicht aktiv.",
    skip: "Zum Referenzinhalt springen",
    locale: "Sprache",
    theme: "Darstellung",
    motion: "Bewegung",
    full: "Voll",
    reduced: "Reduziert",
    light: "Hell",
    dark: "Dunkel",
  },
} as const);

export function GoldenFrame({
  route,
  children,
}: Readonly<{ route: GoldenRouteState; children: ReactNode }>) {
  const copy = REFERENCE_LABELS[route.locale];
  const nextTheme = route.theme === "light" ? "dark" : "light";
  const nextMotion = route.motion === "full" ? "reduced" : "full";

  return (
    <div
      className={styles.root}
      data-capture={route.capture || undefined}
      data-design-system="v2"
      data-golden-reference={route.reference}
      data-golden-ready="true"
      data-golden-state={route.state}
      data-motion={route.motion}
      data-theme={route.theme}
      dir="ltr"
      lang={route.locale}
    >
      <a className={styles.skipLink} href="#golden-main">
        {copy.skip}
      </a>
      <header className={styles.reviewHeader}>
        <a
          aria-label={copy.review}
          className={styles.lockup}
          href={goldenReferenceHref("landing", route.locale, route.theme, route.motion)}
        >
          <GoldenLockup />
        </a>
        <p className={styles.reviewLabel}>{copy.review}</p>
        <div className={styles.reviewUtilities}>
          <span className={styles.utilityLabel}>{copy.locale}</span>
          {(["en", "pl", "de"] as const).map((locale) => (
            <a
              aria-current={locale === route.locale ? "page" : undefined}
              className={styles.utilityLink}
              href={goldenReferenceHref(
                route.reference,
                locale,
                route.theme,
                route.motion,
                route.state,
              )}
              key={locale}
            >
              {locale.toUpperCase()}
            </a>
          ))}
          <a
            className={styles.utilityLink}
            href={goldenReferenceHref(
              route.reference,
              route.locale,
              nextTheme,
              route.motion,
              route.state,
            )}
          >
            {copy.theme}: {copy[nextTheme]}
          </a>
          <a
            className={styles.utilityLink}
            href={goldenReferenceHref(
              route.reference,
              route.locale,
              route.theme,
              nextMotion,
              route.state,
            )}
          >
            {copy.motion}: {copy[nextMotion]}
          </a>
        </div>
      </header>
      <nav aria-label={copy.review} className={styles.referenceNav}>
        {PHASE5A2_GOLDEN_REFERENCES.map((reference, index) => (
          <a
            aria-current={reference === route.reference ? "page" : undefined}
            className={styles.referenceLink}
            data-index={String(index + 1).padStart(2, "0")}
            href={goldenReferenceHref(reference, route.locale, route.theme, route.motion)}
            key={reference}
          >
            {copy[reference]}
          </a>
        ))}
      </nav>
      <main className={styles.main} data-ds-overlay-host="" id="golden-main" tabIndex={-1}>
        {children}
      </main>
      <footer className={styles.reviewFooter}>
        <GoldenLockup compact />
        <p>{copy.synthetic}</p>
        <p>Checkpoint 2 · {copy[route.reference]} · {route.state} · {copy[route.motion]}</p>
      </footer>
    </div>
  );
}
