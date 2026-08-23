import { GOLDEN_COMMON_COPY } from "./common-copy";
import type { GoldenRouteState } from "./contract";
import { EvidenceBand, StateNotice } from "./GoldenEvidence";
import { GoldenGlyph } from "./GoldenGlyph";
import { GoldenMark } from "./GoldenIdentity";
import { PackageLabelNarrative } from "./PackageLabelNarrative.client";
import styles from "./golden.module.css";

const LANDING_COPY = {
  en: {
    eyebrow: "Food intelligence you can inspect",
    title: "Read the package. See the reasoning. Make your own call.",
    intro: "TryVit separates label facts from calculations, context, and decisions—so missing evidence stays visible instead of becoming a confident green answer.",
    primary: "Explore the evidence",
    secondary: "Review the sign-in journey",
    trustTitle: "One answer, four accountable layers",
    trustIntro: "A conclusion is useful only when you can trace what came from the package, what TryVit calculated, what context was applied, and what remains unknown.",
    package: "Package source",
    observed: "Observed facts",
    derived: "Derived interpretation",
    decision: "Decision and next action",
    decode: "Unfold the evidence",
    reset: "Fold back to source",
    methodTitle: "Method before mystique",
    methodBody: "The review fixture uses one package transcription and method v0.9. Its score is visibly derived, confidence is moderate, and processing is not assessed.",
    marketTitle: "Built for real European labels",
    marketBody: "Polish and German expansion, metric units, serving-basis differences, source dates, and incomplete records are part of the interface—not footnotes after launch.",
    privacyTitle: "Private by design in this review",
    privacyBody: "No account, camera, hosted database, analytics, or external product lookup is active. Every product shown here is a deterministic synthetic fixture.",
    finalTitle: "Start with the question. Keep the proof attached.",
    finalBody: "Search the review fixtures, inspect a complete evidence record, or walk through the scanner without granting a real permission.",
    pausedTitle: "Live product data is intentionally paused",
    pausedBody: "The method and synthetic demonstration remain available. No hosted service is used as a fallback.",
    errorTitle: "The interactive demonstration did not complete",
    errorBody: "The product value, method, privacy explanation, and static evidence remain readable without it.",
    offlineTitle: "Offline review",
    offlineBody: "The complete server-rendered explanation and synthetic fixture remain available. External lookup is unavailable by design.",
    observedDetail: "3.2 g sugars per 100 ml · observed 14 July 2026",
    observedMeta: "Synthetic package transcription",
    derivedDetail: "72 / 100 · incomplete inputs · method v0.9",
    contextDetail: "Like-for-like oat-drink basis; processing not assessed",
    decisionDetail: "Check the current package and inspect the missing processing input.",
    themeAction: "Preview dark system",
    themeReset: "Return to light system",
  },
  pl: {
    eyebrow: "Dane o żywności, które można sprawdzić",
    title: "Odczytaj opakowanie. Poznaj tok rozumowania. Podejmij własną decyzję.",
    intro: "TryVit oddziela dane z etykiety od obliczeń, kontekstu i decyzji—brak danych pozostaje widoczny, zamiast zmieniać się w pewną zieloną odpowiedź.",
    primary: "Przejrzyj dane",
    secondary: "Sprawdź proces logowania",
    trustTitle: "Jedna odpowiedź, cztery rozliczalne warstwy",
    trustIntro: "Wniosek jest użyteczny, gdy można sprawdzić dane z opakowania, obliczenia TryVit, zastosowany kontekst i to, czego nadal nie wiadomo.",
    package: "Źródło na opakowaniu",
    observed: "Dane z opakowania",
    derived: "Wyliczona interpretacja",
    decision: "Decyzja i następny krok",
    decode: "Rozwiń dane",
    reset: "Wróć do źródła",
    methodTitle: "Najpierw metoda, potem efekt",
    methodBody: "Materiał testowy korzysta z jednego zapisu z opakowania i metody v0.9. Wynik jest oznaczony jako wyliczony, wiarygodność jest umiarkowana, a przetworzenia nie oceniono.",
    marketTitle: "Projektowany dla europejskich etykiet",
    marketBody: "Polskie i niemieckie teksty, jednostki metryczne, różne porcje, daty źródeł i niepełne rekordy są częścią interfejsu, a nie późniejszym przypisem.",
    privacyTitle: "Prywatność wbudowana w ten przegląd",
    privacyBody: "Konto, aparat, zewnętrzna baza, analityka i wyszukiwanie produktów są nieaktywne. Wszystkie produkty to deterministyczne materiały syntetyczne.",
    finalTitle: "Zacznij od pytania. Zachowaj dostęp do danych.",
    finalBody: "Wyszukaj materiał testowy, przejrzyj pełny rekord albo sprawdź skaner bez udzielania prawdziwego dostępu.",
    pausedTitle: "Dane produktów na żywo są celowo wstrzymane",
    pausedBody: "Metoda i syntetyczna demonstracja pozostają dostępne. Nie korzystamy z usługi zewnętrznej jako rozwiązania awaryjnego.",
    errorTitle: "Interaktywna demonstracja nie została ukończona",
    errorBody: "Wartość produktu, metoda, opis prywatności i statyczne dane pozostają czytelne bez niej.",
    offlineTitle: "Przegląd offline",
    offlineBody: "Pełne wyjaśnienie renderowane przez serwer i materiał syntetyczny pozostają dostępne. Wyszukiwanie zewnętrzne jest celowo niedostępne.",
    observedDetail: "Cukry 3,2 g na 100 ml · zapisano 14 lipca 2026",
    observedMeta: "Syntetyczny zapis z opakowania",
    derivedDetail: "72 / 100 · niepełne dane · metoda v0.9",
    contextDetail: "Porównanie napojów owsianych; przetworzenia nie oceniono",
    decisionDetail: "Sprawdź aktualne opakowanie i brakującą klasyfikację przetworzenia.",
    themeAction: "Wyświetl ciemny motyw",
    themeReset: "Wróć do jasnego motywu",
  },
  de: {
    eyebrow: "Nachprüfbare Lebensmittelinformation",
    title: "Verpackung lesen. Begründung verstehen. Selbst entscheiden.",
    intro: "TryVit trennt Verpackungsangaben von Berechnungen, Kontext und Entscheidungen—fehlende Evidenz bleibt sichtbar, statt zu einer scheinbar sicheren grünen Antwort zu werden.",
    primary: "Evidenz erkunden",
    secondary: "Anmeldeablauf prüfen",
    trustTitle: "Eine Antwort, vier nachvollziehbare Ebenen",
    trustIntro: "Eine Schlussfolgerung ist erst nützlich, wenn Verpackungsangaben, TryVit-Berechnung, angewandter Kontext und offene Fragen nachvollziehbar bleiben.",
    package: "Verpackungsquelle",
    observed: "Verpackungsangaben",
    derived: "Abgeleitete Einordnung",
    decision: "Entscheidung und nächster Schritt",
    decode: "Evidenz entfalten",
    reset: "Zur Quelle zurückfalten",
    methodTitle: "Methode vor Inszenierung",
    methodBody: "Der Prüfsatz nutzt eine Verpackungsabschrift und Methode v0.9. Der Wert ist als abgeleitet gekennzeichnet, die Datenverlässlichkeit ist mittel und die Verarbeitung nicht bewertet.",
    marketTitle: "Für echte europäische Etiketten gedacht",
    marketBody: "Polnische und deutsche Textlängen, metrische Einheiten, Bezugsgrößen, Quelldaten und unvollständige Datensätze gehören zur Oberfläche—nicht in spätere Fußnoten.",
    privacyTitle: "Datenschutz in dieser Prüfung",
    privacyBody: "Konto, Kamera, gehostete Datenbank, Analyse und externe Produktsuche sind nicht aktiv. Alle Produkte sind deterministische synthetische Prüfdaten.",
    finalTitle: "Mit der Frage beginnen. Den Nachweis verbunden lassen.",
    finalBody: "Prüfdaten durchsuchen, einen vollständigen Evidenzdatensatz öffnen oder den Scanner ohne echte Berechtigung durchlaufen.",
    pausedTitle: "Live-Produktdaten sind absichtlich pausiert",
    pausedBody: "Methode und synthetische Demonstration bleiben verfügbar. Es gibt keinen Rückgriff auf einen gehosteten Dienst.",
    errorTitle: "Die interaktive Demonstration wurde nicht abgeschlossen",
    errorBody: "Produktnutzen, Methode, Datenschutzhinweis und statische Evidenz bleiben auch ohne sie lesbar.",
    offlineTitle: "Offline-Prüfung",
    offlineBody: "Die vollständige serverseitige Erklärung und der synthetische Datensatz bleiben verfügbar. Externe Suche ist absichtlich nicht verfügbar.",
    observedDetail: "3,2 g Zucker je 100 ml · beobachtet am 14. Juli 2026",
    observedMeta: "Synthetische Verpackungsabschrift",
    derivedDetail: "72 / 100 · unvollständige Eingaben · Methode v0.9",
    contextDetail: "Vergleichbare Hafergetränke; Verarbeitung nicht bewertet",
    decisionDetail: "Aktuelle Verpackung und fehlende Verarbeitungseingabe prüfen.",
    themeAction: "Dunkles System anzeigen",
    themeReset: "Zum hellen System zurückkehren",
  },
} as const;

export function LandingReference({ route }: Readonly<{ route: GoldenRouteState }>) {
  const copy = LANDING_COPY[route.locale];
  const common = GOLDEN_COMMON_COPY[route.locale];
  const stateNotice = route.state === "data-paused"
    ? { title: copy.pausedTitle, detail: copy.pausedBody, status: "paused" as const }
    : route.state === "demo-error"
      ? { title: copy.errorTitle, detail: copy.errorBody, status: "error" as const }
      : route.state === "offline"
        ? { title: copy.offlineTitle, detail: copy.offlineBody, status: "offline" as const }
        : null;

  return (
    <article className={styles.landing}>
      <section className={styles.landingHero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className={styles.heroIntro}>{copy.intro}</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryAnchor} href={`/dev/phase5a2/golden/product?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=available`}>
              {copy.primary}
            </a>
            <a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/authentication?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=sign-in`}>
              {copy.secondary}
            </a>
          </div>
          {stateNotice ? (
            <StateNotice
              action={
                <a
                  className={styles.secondaryAnchor}
                  href={`/dev/phase5a2/golden/landing?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=ready`}
                >
                  {common.retry}
                </a>
              }
              detail={stateNotice.detail}
              kind={
                stateNotice.status === "error"
                  ? "error"
                  : stateNotice.status === "offline"
                    ? "offline"
                    : "warning"
              }
              title={stateNotice.title}
            />
          ) : null}
        </div>
        <div className={styles.heroMark}>
          <GoldenMark size="large" />
          <span>{common.synthetic}</span>
        </div>
        <PackageLabelNarrative
          actionLabel={copy.decode}
          decisionLabel={copy.decision}
          derivedLabel={copy.derived}
          observedLabel={copy.observed}
          packageLabel={copy.package}
          resetLabel={copy.reset}
          themeActionLabel={copy.themeAction}
          themeResetLabel={copy.themeReset}
        />
      </section>

      <section className={styles.editorialSection}>
        <header className={styles.sectionHeading}>
          <p className={styles.eyebrow}>01</p>
          <h2>{copy.trustTitle}</h2>
          <p>{copy.trustIntro}</p>
        </header>
        <div className={styles.evidenceSpine}>
          <EvidenceBand detail={copy.observedDetail} kind="observed" label={common.observed} meta={copy.observedMeta} title={copy.observed} />
          <EvidenceBand detail={copy.derivedDetail} kind="derived" label={common.derived} meta={common.scoreDerived} title={copy.derived} />
          <EvidenceBand detail={copy.contextDetail} kind="context" label={common.contextual} meta={common.unknownInvariant} title={common.contextual} />
          <EvidenceBand detail={copy.decisionDetail} kind="decision" label={common.decisionLayer} meta={common.packageReminder} title={copy.decision} />
        </div>
      </section>

      <section className={styles.principleGrid}>
        <article><GoldenGlyph name="derived" /><span className={styles.eyebrow}>02</span><h2>{copy.methodTitle}</h2><p>{copy.methodBody}</p></article>
        <article><GoldenGlyph name="context" /><span className={styles.eyebrow}>03</span><h2>{copy.marketTitle}</h2><p>{copy.marketBody}</p></article>
        <article><GoldenGlyph name="confidence" /><span className={styles.eyebrow}>04</span><h2>{copy.privacyTitle}</h2><p>{copy.privacyBody}</p></article>
      </section>

      <section className={styles.finalAction}>
        <div><p className={styles.eyebrow}>05</p><h2>{copy.finalTitle}</h2><p>{copy.finalBody}</p></div>
        <a className={styles.primaryAnchor} href={`/dev/phase5a2/golden/search?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=results`}>
          {common.referenceNames.search}
        </a>
      </section>

    </article>
  );
}
