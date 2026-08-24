import { PageState } from "@/design-system/patterns/PageState/PageState";

import { GOLDEN_COMMON_COPY } from "./common-copy";
import type { GoldenRouteState } from "./contract";
import { DecisionSummary } from "./GoldenEvidence";
import { GoldenGlyph } from "./GoldenGlyph";
import { GoldenSurfaceOwner } from "./GoldenIdentity";
import { HomeControls } from "./HomeControls.client";
import styles from "./golden.module.css";

const HOME_COPY = {
  en: {
    eyebrow: "Your decision workspace",
    title: "Good evening, Marta.",
    intro: "Resume a partial evidence review or start with a product name or barcode.",
    decision: "Review before deciding",
    reason: "Processing is not assessed, so the current concept score is incomplete.",
    resume: "Resume evidence review",
    menu: "More decision actions",
    save: "Save this decision",
    hide: "Hide this record",
    resumed: "Evidence review resumed at the missing processing input.",
    saved: "Decision saved in the local review state.",
    home: "Home",
    discover: "Discover",
    scan: "Scan",
    savedNav: "Saved",
    recent: "Recent decisions",
    savedTitle: "Saved decisions",
    recentDetail: "North Grain Oat Drink · partial evidence · 14 July",
    savedDetail: "Two comparable oat-drink records · method v0.9",
    searchAction: "Search products",
    scanAction: "Open simulated scanner",
    newTitle: "Begin with one package",
    newDetail: "Search a product or use the deterministic scanner. TryVit will keep source facts and derived interpretation separate.",
    emptyTitle: "No saved decisions yet",
    emptyDetail: "Saving a decision keeps its source date, method, confidence reason, and unresolved evidence attached.",
    loadingTitle: "Preparing your local review",
    degradedTitle: "Some recent records are unavailable",
    degradedDetail: "The retained North Grain record remains readable; newer history could not be loaded in this simulation.",
    errorTitle: "The local home simulation stopped",
    errorDetail: "Search and scanner entry remain available. No hosted fallback was attempted.",
    offlineTitle: "Offline workspace",
    offlineDetail: "Previously retained synthetic decisions remain available with their recorded freshness.",
  },
  pl: {
    eyebrow: "Twoje miejsce podejmowania decyzji",
    title: "Dobry wieczór, Marto.",
    intro: "Wznów przegląd niepełnych danych albo zacznij od nazwy produktu lub kodu.",
    decision: "Sprawdź przed decyzją",
    reason: "Nie oceniono przetworzenia, dlatego koncepcyjny wynik jest niepełny.",
    resume: "Wznów przegląd danych",
    menu: "Więcej działań",
    save: "Zapisz decyzję",
    hide: "Ukryj ten rekord",
    resumed: "Wznowiono przegląd przy brakującej klasyfikacji przetworzenia.",
    saved: "Decyzję zapisano w lokalnym stanie testowym.",
    home: "Główna",
    discover: "Odkrywaj",
    scan: "Skanuj",
    savedNav: "Zapisane",
    recent: "Ostatnie decyzje",
    savedTitle: "Zapisane decyzje",
    recentDetail: "Napój owsiany North Grain · niepełne dane · 14 lipca",
    savedDetail: "Dwa porównywalne napoje owsiane · metoda v0.9",
    searchAction: "Wyszukaj produkty",
    scanAction: "Otwórz symulowany skaner",
    newTitle: "Zacznij od jednego opakowania",
    newDetail: "Wyszukaj produkt albo użyj deterministycznego skanera. TryVit oddzieli dane źródłowe od wyliczonej interpretacji.",
    emptyTitle: "Brak zapisanych decyzji",
    emptyDetail: "Zapisana decyzja zachowuje datę źródła, metodę, powód wiarygodności i nierozstrzygnięte dane.",
    loadingTitle: "Przygotowywanie lokalnego widoku",
    degradedTitle: "Część ostatnich rekordów jest niedostępna",
    degradedDetail: "Zachowany rekord North Grain pozostaje czytelny; nowszej historii nie wczytano w tej symulacji.",
    errorTitle: "Lokalna symulacja panelu została przerwana",
    errorDetail: "Wyszukiwanie i skaner pozostają dostępne. Nie użyto zewnętrznej usługi awaryjnej.",
    offlineTitle: "Miejsce pracy offline",
    offlineDetail: "Zachowane syntetyczne decyzje są dostępne razem z datą aktualności.",
  },
  de: {
    eyebrow: "Arbeitsbereich für Entscheidungen",
    title: "Guten Abend, Marta.",
    intro: "Eine unvollständige Evidenzprüfung fortsetzen oder mit Produktname beziehungsweise Strichcode beginnen.",
    decision: "Vor der Entscheidung prüfen",
    reason: "Die Verarbeitung ist nicht bewertet; der konzeptionelle Wert ist deshalb unvollständig.",
    resume: "Evidenzprüfung fortsetzen",
    menu: "Weitere Entscheidungsaktionen",
    save: "Entscheidung speichern",
    hide: "Datensatz ausblenden",
    resumed: "Die Evidenzprüfung wurde bei der fehlenden Verarbeitungseingabe fortgesetzt.",
    saved: "Die Entscheidung wurde im lokalen Prüfzustand gespeichert.",
    home: "Übersicht",
    discover: "Entdecken",
    scan: "Scannen",
    savedNav: "Gespeichert",
    recent: "Letzte Entscheidungen",
    savedTitle: "Gespeicherte Entscheidungen",
    recentDetail: "North Grain Hafergetränk · teilweise Evidenz · 14. Juli",
    savedDetail: "Zwei vergleichbare Hafergetränke · Methode v0.9",
    searchAction: "Produkte suchen",
    scanAction: "Simulierten Scanner öffnen",
    newTitle: "Mit einer Verpackung beginnen",
    newDetail: "Ein Produkt suchen oder den deterministischen Scanner verwenden. TryVit trennt Quellenangaben von abgeleiteter Einordnung.",
    emptyTitle: "Noch keine Entscheidungen gespeichert",
    emptyDetail: "Eine gespeicherte Entscheidung behält Quelldatum, Methode, Vertrauensgrund und ungeklärte Evidenz.",
    loadingTitle: "Lokale Prüfung wird vorbereitet",
    degradedTitle: "Einige neue Datensätze sind nicht verfügbar",
    degradedDetail: "Der gespeicherte North-Grain-Datensatz bleibt lesbar; neuere Historie konnte in dieser Simulation nicht geladen werden.",
    errorTitle: "Die lokale Übersichtssimulation wurde unterbrochen",
    errorDetail: "Suche und Scanner bleiben verfügbar. Kein gehosteter Ausweichdienst wurde verwendet.",
    offlineTitle: "Offline-Arbeitsbereich",
    offlineDetail: "Zuvor gespeicherte synthetische Entscheidungen bleiben mit ihrem Aktualitätsdatum verfügbar.",
  },
} as const;

export function HomeReference({ route }: Readonly<{ route: GoldenRouteState }>) {
  const copy = HOME_COPY[route.locale];
  const common = GOLDEN_COMMON_COPY[route.locale];
  const isNew = route.state === "new";
  const isEmpty = route.state === "empty-saved";
  const state = route.state === "loading"
    ? { status: "loading" as const, title: copy.loadingTitle, detail: copy.intro }
    : route.state === "degraded" || route.state === "paused-partial"
      ? { status: route.state === "paused-partial" ? "paused" as const : "degraded" as const, title: copy.degradedTitle, detail: copy.degradedDetail }
      : route.state === "service-error"
        ? { status: "error" as const, title: copy.errorTitle, detail: copy.errorDetail }
        : route.state === "offline"
          ? { status: "offline" as const, title: copy.offlineTitle, detail: copy.offlineDetail }
          : null;
  const query = `locale=${route.locale}&theme=${route.theme}&motion=${route.motion}${route.capture ? "&capture=1" : ""}`;

  return (
    <article className={styles.homeReference}>
      <header className={styles.appHeader}>
        <div><GoldenSurfaceOwner label={common.ownerLabel} /><p className={styles.eyebrow}>{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p></div>
        <nav aria-label={copy.eyebrow} className={styles.appNav}>
          <a aria-current="page" href="#golden-main"><GoldenGlyph name="decision" />{copy.home}</a>
          <a href={`/dev/phase5a2/golden/search?${query}&state=results`}><GoldenGlyph name="compare" />{copy.discover}</a>
          <a href={`/dev/phase5a2/golden/scanner?${query}&state=not-requested`}><GoldenGlyph name="scanner" />{copy.scan}</a>
          <a href="#saved-decisions"><GoldenGlyph name="source" />{copy.savedNav}</a>
        </nav>
      </header>

      {state ? (
        <PageState
          description={state.detail}
          headingLevel={2}
          primaryAction={<a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/home?${query}&state=returning`}>{common.retry}</a>}
          status={state.status}
          title={state.title}
        />
      ) : null}

      {isNew ? (
        <section className={styles.homeWelcome}>
          <GoldenGlyph name="source" size={32} />
          <div><h2>{copy.newTitle}</h2><p>{copy.newDetail}</p></div>
          <div className={styles.heroActions}>
            <a className={styles.primaryAnchor} href={`/dev/phase5a2/golden/search?${query}&state=no-query`}>{copy.searchAction}</a>
            <a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/scanner?${query}&state=not-requested`}>{copy.scanAction}</a>
          </div>
        </section>
      ) : (
        <section className={styles.homeDecision}>
          <DecisionSummary
            confidenceReason={common.confidenceReason}
            copy={common}
            decision={copy.decision}
            mainReason={copy.reason}
            nextAction={<HomeControls hideLabel={copy.hide} menuLabel={copy.menu} resumeLabel={copy.resume} resumedMessage={copy.resumed} saveLabel={copy.save} savedMessage={copy.saved} />}
            provisionalScore={72}
            score={null}
          />
        </section>
      )}

      <section className={styles.homeGrid} id="saved-decisions">
        <article><span className={styles.eyebrow}>01</span><h2>{copy.recent}</h2><p>{copy.recentDetail}</p><a href={`/dev/phase5a2/golden/product?${query}&state=partial`}>{copy.resume}</a></article>
        <article><span className={styles.eyebrow}>02</span><h2>{copy.savedTitle}</h2>{isEmpty ? <PageState description={copy.emptyDetail} headingLevel={3} status="empty" title={copy.emptyTitle} /> : <><p>{copy.savedDetail}</p><a href={`/dev/phase5a2/golden/search?${query}&state=filters-active`}>{copy.searchAction}</a></>}</article>
        <article className={styles.homeQuick}><span className={styles.eyebrow}>03</span><h2>{copy.discover}</h2><a className={styles.primaryAnchor} href={`/dev/phase5a2/golden/search?${query}&state=no-query`}>{copy.searchAction}</a><a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/scanner?${query}&state=not-requested`}>{copy.scanAction}</a></article>
      </section>
    </article>
  );
}
