import { Surface } from "@/design-system/primitives/Surface/Surface";
import { Tabs } from "@/design-system/primitives/Tabs";

import { MotionStudy, type MotionStudyCopy } from "@/app/dev/phase5a2/_shared/MotionStudy.client";
import { ProductLookup } from "@/app/dev/phase5a2/_shared/ProductLookup.client";
import { ScannerStudy } from "@/app/dev/phase5a2/_shared/ScannerStudy.client";
import {
  phase5A2ReviewHref,
  type Phase5A2Locale,
  type Phase5A2RouteState,
} from "@/app/dev/phase5a2/_shared/contract";
import { PHASE5A2_FIXTURE } from "@/app/dev/phase5a2/_shared/fixture";
import { PHASE5A2_COMMON_MESSAGES } from "@/app/dev/phase5a2/_shared/messages";

import styles from "./open-core.module.css";

interface OpenCoreEvidenceItem {
  readonly label: string;
  readonly kind: string;
  readonly body: string;
}

interface OpenCoreMessages {
  readonly direction: string;
  readonly nav: readonly [string, string, string];
  readonly identityKicker: string;
  readonly identityDescription: string;
  readonly identityCharacter: string;
  readonly identityAvoid: string;
  readonly identityTagline: string;
  readonly identityPrimaryLabel: string;
  readonly identityVariantsLabel: string;
  readonly identityPaletteLabel: string;
  readonly identityVariantLabels: readonly [string, string, string, string, string];
  readonly identityDetailLabels: readonly [string, string, string, string];
  readonly identityTypography: string;
  readonly identityStatus: string;
  readonly landingEyebrow: string;
  readonly landingTitle: string;
  readonly landingBody: string;
  readonly primaryAction: string;
  readonly secondaryAction: string;
  readonly depthHeading: string;
  readonly depths: readonly {
    readonly index: string;
    readonly title: string;
    readonly body: string;
  }[];
  readonly homeTitle: string;
  readonly homeLead: string;
  readonly continueReview: string;
  readonly openReview: string;
  readonly homeState: Readonly<Record<"returning" | "new" | "paused" | "error", string>>;
  readonly productTitle: string;
  readonly productLead: string;
  readonly productIndex: string;
  readonly evidenceHeading: string;
  readonly evidence: readonly OpenCoreEvidenceItem[];
  readonly scoreLabel: string;
  readonly sourceHeading: string;
  readonly sourcePackage: string;
  readonly sourceIndependent: string;
  readonly sourceProcessing: string;
  readonly factsLabel: string;
  readonly factsTabs: readonly [string, string, string, string];
  readonly nutritionCaption: string;
  readonly nutritionRows: readonly (readonly [string, string])[];
  readonly ingredientText: string;
  readonly allergenText: string;
  readonly provenanceText: string;
  readonly scannerKicker: string;
  readonly scannerTitle: string;
  readonly scannerLead: string;
  readonly scannerResult: string;
  readonly motionKicker: string;
  readonly motionTitle: string;
  readonly motionLead: string;
  readonly motion: MotionStudyCopy;
}

const OPEN_CORE_MESSAGES: Readonly<Record<Phase5A2Locale, OpenCoreMessages>> = {
  en: {
    direction: "Open Core",
    nav: ["Today", "Evidence", "Scan"],
    identityKicker: "Candidate C · preliminary geometry",
    identityDescription: "An open identity for moving from a calm answer into the evidence beneath it.",
    identityCharacter: "Breathable structure · nested reading depths · an intentionally open edge.",
    identityAvoid: "Do not close the rings, turn the sample into a sparkle, add a gradient, or treat coral as a health rating.",
    identityTagline: "decision / evidence / source",
    identityPrimaryLabel: "Primary identity lockup",
    identityVariantsLabel: "Identity variants",
    identityPaletteLabel: "Open Core palette",
    identityVariantLabels: ["Primary", "Dark", "Monochrome", "Micro", "Maskable study"],
    identityDetailLabels: ["Character", "Typography proposal", "Do not", "Status"],
    identityTypography: "Atkinson Hyperlegible Next + Newsreader. System-stack approximation here; no font adopted.",
    identityStatus: "Working codename. Preliminary vector. Not name- or trademark-cleared.",
    landingEyebrow: "Read only as deep as you need",
    landingTitle: "A clear decision, with room to look inside.",
    landingBody: "TryVit starts with a useful summary, then leaves every evidence layer open: observed facts, the calculation, context, and the original package note.",
    primaryAction: "Open the review fixture",
    secondaryAction: "See the three depths",
    depthHeading: "One decision. Three reading depths.",
    depths: [
      { index: "01", title: "Decide", body: "See the concept signal, confidence, and next action together." },
      { index: "02", title: "Understand", body: "Separate observed facts, calculation, and interpretation." },
      { index: "03", title: "Trace", body: "Return to the dated package transcription and its limits." },
    ],
    homeTitle: "Your open decisions",
    homeLead: "Resume at the depth you last needed. The source remains one step away.",
    continueReview: "Continue review",
    openReview: "Open evidence",
    homeState: {
      returning: "One review is ready to continue.",
      new: "Start with the synthetic review fixture.",
      paused: "The review is paused; its source is unchanged.",
      error: "The live source is unavailable; the fixed review fixture remains visible.",
    },
    productTitle: "North Grain Oat Drink",
    productLead: "A concept summary with the evidence left open—not a universal health verdict.",
    productIndex: "Reading depth",
    evidenceHeading: "What supports this decision",
    evidence: [
      { label: "Observed", kind: "Direct", body: "Package transcription dated 14 July 2026. Contains oats; may contain soy." },
      { label: "Calculated", kind: "Derived", body: "Concept decision score: 72 out of 100, calculated only from this closed fixture." },
      { label: "Contextualized", kind: "Interpretive", body: "Moderate confidence. Processing classification is unconfirmed." },
      { label: "Decision", kind: "Action", body: "Compare the evidence and check the current package before deciding." },
    ],
    scoreLabel: "Concept signal",
    sourceHeading: "Source state",
    sourcePackage: "1 package transcription",
    sourceIndependent: "0 independent verifications",
    sourceProcessing: "Processing unconfirmed",
    factsLabel: "Product evidence details",
    factsTabs: ["Nutrition", "Ingredients", "Allergens", "Provenance"],
    nutritionCaption: "Nutrition per 100 ml",
    nutritionRows: [
      ["Energy", "193 kJ / 46 kcal"],
      ["Fat / saturates", "1.5 g / 0.2 g"],
      ["Carbohydrate / sugars", "7.4 g / 3.2 g"],
      ["Fibre / protein", "0.8 g / 1.0 g"],
      ["Salt", "0.10 g"],
    ],
    ingredientText: "Oat-base package transcription for review only. A full ingredient verification is unavailable.",
    allergenText: "Contains oats. May contain soy. Evidence for all other allergens is unavailable.",
    provenanceText: "Observed 14 July 2026. One package transcription; no independent verification.",
    scannerKicker: "Scanner concept · no camera",
    scannerTitle: "Open the result in layers",
    scannerLead: "A deterministic study using one synthetic barcode. It never requests camera access or contacts a service.",
    scannerResult: "Fixed fixture reference · not the current scan result",
    motionKicker: "Motion study · 0/120/180/240/360/500ms",
    motionTitle: "The core opens without hiding the source",
    motionLead: "Only opacity and transform change. Every fact is mounted before the sequence begins.",
    motion: {
      stages: [
        { id: "signal", label: "Decision signal", description: "The useful summary arrives first without claiming certainty." },
        { id: "evidence", label: "Evidence layer", description: "Observed and calculated facts open around the summary." },
        { id: "context", label: "Context layer", description: "Confidence and unknowns remain adjacent to the calculation." },
        { id: "source", label: "Source layer", description: "The sequence ends at the dated package transcription." },
      ],
      previous: "Previous depth",
      next: "Next depth",
      restart: "Restart study",
    },
  },
  pl: {
    direction: "Open Core",
    nav: ["Dzisiaj", "Dowody", "Skanuj"],
    identityKicker: "Kandydat C · geometria wstępna",
    identityDescription: "Otwarta tożsamość, która prowadzi od spokojnej odpowiedzi do stojących za nią dowodów.",
    identityCharacter: "Lekka struktura · zagnieżdżone poziomy lektury · celowo otwarta krawędź.",
    identityAvoid: "Nie zamykaj pierścieni, nie zmieniaj próbki w błysk, nie dodawaj gradientu i nie używaj koralu jako oceny zdrowotnej.",
    identityTagline: "decyzja / dowody / źródło",
    identityPrimaryLabel: "Podstawowy układ znaku",
    identityVariantsLabel: "Warianty tożsamości",
    identityPaletteLabel: "Paleta Open Core",
    identityVariantLabels: ["Podstawowy", "Ciemny", "Monochromatyczny", "Mikro", "Studium maskowalne"],
    identityDetailLabels: ["Charakter", "Propozycja typografii", "Nie należy", "Status"],
    identityTypography: "Atkinson Hyperlegible Next + Newsreader. W tym prototypie użyto przybliżenia krojami systemowymi; nie przyjęto żadnego kroju pisma.",
    identityStatus: "Nazwa robocza. Wstępny wektor. Bez weryfikacji nazwy i znaku towarowego.",
    landingEyebrow: "Czytaj tylko tak głęboko, jak potrzebujesz",
    landingTitle: "Jasna decyzja z przestrzenią, by zajrzeć do środka.",
    landingBody: "TryVit zaczyna od użytecznego podsumowania, a potem pozostawia otwarte wszystkie warstwy dowodów: fakty, obliczenie, kontekst i notatkę z opakowania.",
    primaryAction: "Otwórz materiał testowy",
    secondaryAction: "Zobacz trzy poziomy",
    depthHeading: "Jedna decyzja. Trzy poziomy lektury.",
    depths: [
      { index: "01", title: "Zdecyduj", body: "Zobacz razem sygnał koncepcyjny, pewność i następne działanie." },
      { index: "02", title: "Zrozum", body: "Oddziel fakty zaobserwowane, obliczenie i interpretację." },
      { index: "03", title: "Prześledź", body: "Wróć do datowanej transkrypcji opakowania i jej ograniczeń." },
    ],
    homeTitle: "Twoje otwarte decyzje",
    homeLead: "Wróć do poziomu, którego ostatnio potrzebowałeś. Źródło jest o krok dalej.",
    continueReview: "Kontynuuj przegląd",
    openReview: "Otwórz dowody",
    homeState: {
      returning: "Jeden przegląd jest gotowy do kontynuacji.",
      new: "Zacznij od syntetycznego materiału testowego.",
      paused: "Przegląd jest wstrzymany; jego źródło się nie zmieniło.",
      error: "Bieżące źródło jest niedostępne; stały materiał testowy pozostaje widoczny.",
    },
    productTitle: "North Grain Oat Drink",
    productLead: "Podsumowanie koncepcyjne z otwartymi dowodami — nie uniwersalny werdykt zdrowotny.",
    productIndex: "Poziom lektury",
    evidenceHeading: "Co wspiera tę decyzję",
    evidence: [
      { label: "Zaobserwowane", kind: "Bezpośrednie", body: "Transkrypcja opakowania z 14 lipca 2026. Zawiera owies; może zawierać soję." },
      { label: "Obliczone", kind: "Pochodne", body: "Koncepcyjny wynik decyzji: 72 na 100, obliczony tylko z zamkniętego materiału testowego." },
      { label: "W kontekście", kind: "Interpretacyjne", body: "Umiarkowana pewność. Klasyfikacja przetworzenia niepotwierdzona." },
      { label: "Decyzja", kind: "Działanie", body: "Porównaj dowody i sprawdź aktualne opakowanie przed podjęciem decyzji." },
    ],
    scoreLabel: "Sygnał koncepcyjny",
    sourceHeading: "Stan źródła",
    sourcePackage: "1 transkrypcja opakowania",
    sourceIndependent: "0 niezależnych weryfikacji",
    sourceProcessing: "Przetworzenie niepotwierdzone",
    factsLabel: "Szczegóły dowodów o produkcie",
    factsTabs: ["Wartości", "Składniki", "Alergeny", "Pochodzenie"],
    nutritionCaption: "Wartości odżywcze w 100 ml",
    nutritionRows: [
      ["Energia", "193 kJ / 46 kcal"],
      ["Tłuszcz / nasycone", "1,5 g / 0,2 g"],
      ["Węglowodany / cukry", "7,4 g / 3,2 g"],
      ["Błonnik / białko", "0,8 g / 1,0 g"],
      ["Sól", "0,10 g"],
    ],
    ingredientText: "Transkrypcja składu bazy owsianej wyłącznie do przeglądu. Pełna weryfikacja składników jest niedostępna.",
    allergenText: "Zawiera owies. Może zawierać soję. Dane o pozostałych alergenach są niedostępne.",
    provenanceText: "Zaobserwowano 14 lipca 2026. Jedna transkrypcja opakowania; bez niezależnej weryfikacji.",
    scannerKicker: "Koncepcja skanera · bez aparatu",
    scannerTitle: "Otwórz wynik warstwami",
    scannerLead: "Deterministyczna koncepcja z jednym syntetycznym kodem. Nie prosi o dostęp do aparatu ani nie łączy się z usługą.",
    scannerResult: "Stały materiał odniesienia · nie jest bieżącym wynikiem skanu",
    motionKicker: "Studium ruchu · 0/120/180/240/360/500 ms",
    motionTitle: "Rdzeń otwiera się bez ukrywania źródła",
    motionLead: "Zmieniają się tylko przezroczystość i położenie. Wszystkie fakty są obecne przed rozpoczęciem sekwencji.",
    motion: {
      stages: [
        { id: "signal", label: "Sygnał decyzji", description: "Użyteczne podsumowanie pojawia się pierwsze, bez deklarowania pewności." },
        { id: "evidence", label: "Warstwa dowodów", description: "Fakty zaobserwowane i obliczone otwierają się wokół podsumowania." },
        { id: "context", label: "Warstwa kontekstu", description: "Pewność i niewiadome pozostają obok obliczenia." },
        { id: "source", label: "Warstwa źródła", description: "Sekwencja kończy się na datowanej transkrypcji opakowania." },
      ],
      previous: "Poprzedni poziom",
      next: "Następny poziom",
      restart: "Uruchom ponownie",
    },
  },
  de: {
    direction: "Open Core",
    nav: ["Heute", "Evidenz", "Scannen"],
    identityKicker: "Kandidat C · vorläufige Geometrie",
    identityDescription: "Eine offene Identität, die von einer ruhigen Antwort zur darunterliegenden Evidenz führt.",
    identityCharacter: "Luftige Struktur · verschachtelte Lesetiefen · bewusst offene Kante.",
    identityAvoid: "Ringe nicht schließen, das Muster nicht zum Glitzern machen, keinen Verlauf ergänzen und Koralle nicht als Gesundheitswertung einsetzen.",
    identityTagline: "Entscheidung / Evidenz / Quelle",
    identityPrimaryLabel: "Primäre Markenkombination",
    identityVariantsLabel: "Identitätsvarianten",
    identityPaletteLabel: "Open-Core-Farbpalette",
    identityVariantLabels: ["Primär", "Dunkel", "Monochrom", "Mikro", "Maskierbare Studie"],
    identityDetailLabels: ["Charakter", "Typografie-Vorschlag", "Nicht verwenden", "Status"],
    identityTypography: "Atkinson Hyperlegible Next + Newsreader. Hier als Annäherung mit Systemschriften; keine Schrift wurde übernommen.",
    identityStatus: "Arbeitsname. Vorläufige Vektorgeometrie. Name und Marke wurden nicht geprüft.",
    landingEyebrow: "Lesen Sie nur so tief, wie Sie möchten",
    landingTitle: "Eine klare Entscheidung mit Raum für den Blick ins Innere.",
    landingBody: "TryVit beginnt mit einer nützlichen Zusammenfassung und lässt dann jede Evidenzebene offen: Beobachtung, Berechnung, Kontext und die Notiz von der Verpackung.",
    primaryAction: "Prüfmuster öffnen",
    secondaryAction: "Drei Lesetiefen ansehen",
    depthHeading: "Eine Entscheidung. Drei Lesetiefen.",
    depths: [
      { index: "01", title: "Entscheiden", body: "Konzeptsignal, Verlässlichkeit und nächste Handlung gemeinsam sehen." },
      { index: "02", title: "Verstehen", body: "Beobachtete Fakten, Berechnung und Interpretation voneinander trennen." },
      { index: "03", title: "Zurückverfolgen", body: "Zur datierten Verpackungsabschrift und ihren Grenzen zurückkehren." },
    ],
    homeTitle: "Ihre offenen Entscheidungen",
    homeLead: "Machen Sie in der zuletzt benötigten Tiefe weiter. Die Quelle bleibt nur einen Schritt entfernt.",
    continueReview: "Prüfung fortsetzen",
    openReview: "Evidenz öffnen",
    homeState: {
      returning: "Eine Prüfung kann fortgesetzt werden.",
      new: "Beginnen Sie mit dem synthetischen Prüfmuster.",
      paused: "Die Prüfung ist pausiert; ihre Quelle ist unverändert.",
      error: "Die aktuelle Quelle ist nicht verfügbar; das feste Prüfmuster bleibt sichtbar.",
    },
    productTitle: "North Grain Oat Drink",
    productLead: "Eine konzeptionelle Zusammenfassung mit offener Evidenz — kein allgemeines Gesundheitsurteil.",
    productIndex: "Lesetiefe",
    evidenceHeading: "Was diese Entscheidung stützt",
    evidence: [
      { label: "Beobachtet", kind: "Direkt", body: "Verpackungsabschrift vom 14. Juli 2026. Enthält Hafer; kann Soja enthalten." },
      { label: "Berechnet", kind: "Abgeleitet", body: "Konzeptionelles Entscheidungsergebnis: 72 von 100, nur aus diesem geschlossenen Prüfmuster berechnet." },
      { label: "Kontextualisiert", kind: "Interpretativ", body: "Mittlere Verlässlichkeit. Verarbeitungsklassifikation unbestätigt." },
      { label: "Entscheidung", kind: "Handlung", body: "Vergleichen Sie die Evidenz und prüfen Sie vor der Entscheidung die aktuelle Verpackung." },
    ],
    scoreLabel: "Konzeptsignal",
    sourceHeading: "Quellenstatus",
    sourcePackage: "1 Verpackungsabschrift",
    sourceIndependent: "0 unabhängige Überprüfungen",
    sourceProcessing: "Verarbeitung unbestätigt",
    factsLabel: "Details zur Produktevidenz",
    factsTabs: ["Nährwerte", "Zutaten", "Allergene", "Herkunft"],
    nutritionCaption: "Nährwerte je 100 ml",
    nutritionRows: [
      ["Energie", "193 kJ / 46 kcal"],
      ["Fett / gesättigt", "1,5 g / 0,2 g"],
      ["Kohlenhydrate / Zucker", "7,4 g / 3,2 g"],
      ["Ballaststoffe / Protein", "0,8 g / 1,0 g"],
      ["Salz", "0,10 g"],
    ],
    ingredientText: "Abschrift der Haferbasis nur zur Prüfung. Eine vollständige Zutatenüberprüfung ist nicht verfügbar.",
    allergenText: "Enthält Hafer. Kann Soja enthalten. Evidenz zu allen weiteren Allergenen ist nicht verfügbar.",
    provenanceText: "Beobachtet am 14. Juli 2026. Eine Verpackungsabschrift; keine unabhängige Überprüfung.",
    scannerKicker: "Scannerkonzept · keine Kamera",
    scannerTitle: "Ergebnis in Ebenen öffnen",
    scannerLead: "Eine deterministische Studie mit einem synthetischen Strichcode. Sie fordert keinen Kamerazugriff an und kontaktiert keinen Dienst.",
    scannerResult: "Feste Prüfreferenz · nicht das aktuelle Scanergebnis",
    motionKicker: "Bewegungsstudie · 0/120/180/240/360/500 ms",
    motionTitle: "Der Kern öffnet sich, ohne die Quelle zu verbergen",
    motionLead: "Nur Deckkraft und Position ändern sich. Alle Fakten sind vor Beginn der Sequenz eingebunden.",
    motion: {
      stages: [
        { id: "signal", label: "Entscheidungssignal", description: "Die nützliche Zusammenfassung erscheint zuerst, ohne Gewissheit zu behaupten." },
        { id: "evidence", label: "Evidenzebene", description: "Beobachtete und berechnete Fakten öffnen sich um die Zusammenfassung." },
        { id: "context", label: "Kontextebene", description: "Verlässlichkeit und offene Fragen bleiben neben der Berechnung." },
        { id: "source", label: "Quellenebene", description: "Die Sequenz endet bei der datierten Verpackungsabschrift." },
      ],
      previous: "Vorherige Tiefe",
      next: "Nächste Tiefe",
      restart: "Studie neu starten",
    },
  },
};

function OpenCoreMark({ className = "" }: Readonly<{ className?: string }>) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 64 64">
      <path className={styles.markOuter} d="M43 8H20L8 20V44L20 56H44L56 44V25" />
      <path className={styles.markMiddle} d="M40 18H24L18 24V40L24 46H40L46 40V31" />
      <path className={styles.markInner} d="M36 27H30L27 30V36L30 39H36L39 36V34" />
      <path className={styles.markSample} d="M52 11L56 15L52 19L48 15Z" />
    </svg>
  );
}

function OpenCoreHeader({ messages, route }: Readonly<{ messages: OpenCoreMessages; route: Phase5A2RouteState }>) {
  return (
    <header className={styles.header}>
      <a className={styles.brand} href={phase5A2ReviewHref("open-core", "landing", route.locale, route.theme, route.motion)}>
        <OpenCoreMark />
        <span>TryVit</span>
      </a>
      <nav aria-label={PHASE5A2_COMMON_MESSAGES[route.locale].navigationLabel}>
        <a href={phase5A2ReviewHref("open-core", "home", route.locale, route.theme, route.motion)}>{messages.nav[0]}</a>
        <a href={phase5A2ReviewHref("open-core", "product", route.locale, route.theme, route.motion)}>{messages.nav[1]}</a>
        <a href={phase5A2ReviewHref("open-core", "scanner", route.locale, route.theme, route.motion)}>{messages.nav[2]}</a>
      </nav>
      <span className={styles.candidateLabel}>{messages.direction} · C</span>
    </header>
  );
}

function Depths({ messages, compact = false }: Readonly<{ messages: OpenCoreMessages; compact?: boolean }>) {
  return (
    <ol className={compact ? styles.depthsCompact : styles.depths}>
      {messages.depths.map((depth) => (
        <li key={depth.index}>
          <span>{depth.index}</span>
          <div><h3>{depth.title}</h3><p>{depth.body}</p></div>
        </li>
      ))}
    </ol>
  );
}

function EvidenceSequence({ messages }: Readonly<{ messages: OpenCoreMessages }>) {
  return (
    <ol className={styles.evidenceSequence}>
      {messages.evidence.map((item, index) => (
        <li key={item.label}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div><small>{item.kind}</small><h3>{item.label}</h3><p>{item.body}</p></div>
        </li>
      ))}
    </ol>
  );
}

function IdentitySurface({ messages }: Readonly<{ messages: OpenCoreMessages }>) {
  return (
    <div className={styles.identityBoard}>
      <header className={styles.identityIntro}>
        <div><span>{messages.identityKicker}</span><h1>Open Core</h1></div>
        <p>{messages.identityDescription}</p>
      </header>
      <section aria-label={messages.identityPrimaryLabel} className={styles.identityHero}>
        <OpenCoreMark className={styles.identityMark} />
        <div><strong>TryVit</strong><span>{messages.identityTagline}</span></div>
      </section>
      <section aria-label={messages.identityVariantsLabel} className={styles.identityVariants}>
        <figure><OpenCoreMark /><figcaption>{messages.identityVariantLabels[0]} · 64</figcaption></figure>
        <figure className={styles.darkSpecimen}><OpenCoreMark /><figcaption>{messages.identityVariantLabels[1]}</figcaption></figure>
        <figure className={styles.monoSpecimen}><OpenCoreMark /><figcaption>{messages.identityVariantLabels[2]}</figcaption></figure>
        <figure className={styles.microSpecimen}><OpenCoreMark /><figcaption>{messages.identityVariantLabels[3]} · 16</figcaption></figure>
        <figure className={styles.maskSpecimen}><OpenCoreMark /><figcaption>{messages.identityVariantLabels[4]}</figcaption></figure>
      </section>
      <section className={styles.identityDetails}>
        <div><span>{messages.identityDetailLabels[0]}</span><p>{messages.identityCharacter}</p></div>
        <div><span>{messages.identityDetailLabels[1]}</span><p>{messages.identityTypography}</p></div>
        <div><span>{messages.identityDetailLabels[2]}</span><p>{messages.identityAvoid}</p></div>
        <div><span>{messages.identityDetailLabels[3]}</span><p>{messages.identityStatus}</p></div>
      </section>
      <div aria-label={messages.identityPaletteLabel} className={styles.palette}><span /><span /><span /><span /></div>
    </div>
  );
}

function LandingSurface({ messages, route }: Readonly<{ messages: OpenCoreMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  return (
    <>
      <OpenCoreHeader messages={messages} route={route} />
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{messages.landingEyebrow}</span>
          <h1>{messages.landingTitle}</h1>
          <p>{messages.landingBody}</p>
          <div className={styles.heroActions}>
            <a href={phase5A2ReviewHref("open-core", "product", route.locale, route.theme, route.motion)}>{messages.primaryAction}</a>
            <a href="#open-core-depths">{messages.secondaryAction}</a>
          </div>
          <small>{common.syntheticDisclosure} · {common.notMedicalAdvice}</small>
        </div>
        <figure className={styles.heroDiagram}>
          <OpenCoreMark />
          <div className={styles.heroSignal}>
            <span>{messages.scoreLabel}</span>
            <strong>{PHASE5A2_FIXTURE.conceptDecisionScore}<small>/100</small></strong>
            <p>{common.confidence}</p>
          </div>
          <figcaption>{common.confidenceExplanation}</figcaption>
        </figure>
      </section>
      <section className={styles.depthSection} id="open-core-depths">
        <header><span>01 / 02 / 03</span><h2>{messages.depthHeading}</h2></header>
        <Depths messages={messages} />
      </section>
    </>
  );
}

function HomeSurface({ messages, route }: Readonly<{ messages: OpenCoreMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  const homeState = route.state as keyof OpenCoreMessages["homeState"];
  return (
    <>
      <OpenCoreHeader messages={messages} route={route} />
      <div className={styles.homeShell}>
        <nav aria-label={common.navigationLabel} className={styles.homeRail}>
          <OpenCoreMark />
          <a aria-current="location" href="#open-decisions">{messages.nav[0]}</a>
          <a href="#home-depths">{messages.productIndex}</a>
          <a href="#home-source">{messages.sourceHeading}</a>
        </nav>
        <section className={styles.homeWorkspace} id="open-decisions">
          <header><span>{common.syntheticDisclosure}</span><h1>{messages.homeTitle}</h1><p>{messages.homeLead}</p><small>{messages.homeState[homeState]}</small></header>
          <div className={styles.homeSearch}>
            <ProductLookup
              copy={common.productLookup}
              ean={PHASE5A2_FIXTURE.ean}
              fixtureName={common.fixtureName}
            />
          </div>
          <Surface as="article" boundary="strong" className={styles.decisionCard} density="none">
            <div className={styles.decisionSummary}>
              <span>{messages.continueReview}</span>
              <h2>{common.fixtureName}</h2>
              <p>{common.observedDate}</p>
              <a href={phase5A2ReviewHref("open-core", "product", route.locale, route.theme, route.motion)}>{messages.openReview}</a>
            </div>
            <div className={styles.decisionSignal}><OpenCoreMark /><span>{messages.scoreLabel}</span><strong>{PHASE5A2_FIXTURE.conceptDecisionScore}<small>/100</small></strong><p>{common.confidence}</p></div>
            <div className={styles.decisionLimits} id="home-source"><span>{messages.sourceHeading}</span><p>{common.confidenceExplanation}</p><p>{common.processingUnknown}</p></div>
          </Surface>
          <section className={styles.homeDepths} id="home-depths"><h2>{messages.depthHeading}</h2><Depths compact messages={messages} /></section>
        </section>
      </div>
    </>
  );
}

function NutritionTable({ messages }: Readonly<{ messages: OpenCoreMessages }>) {
  return (
    <table className={styles.nutritionTable}>
      <caption>{messages.nutritionCaption}</caption>
      <tbody>{messages.nutritionRows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody>
    </table>
  );
}

function ProductSurface({ messages, route }: Readonly<{ messages: OpenCoreMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  const defaultTab = route.state === "evidence" ? "provenance" : "nutrition";
  return (
    <>
      <OpenCoreHeader messages={messages} route={route} />
      <article className={styles.product}>
        <header className={styles.productHero} id="product-decision">
          <div className={styles.productSummary}>
            <span>{common.syntheticDisclosure}</span>
            <h1>{messages.productTitle}</h1>
            <p>{messages.productLead}</p>
            <div className={styles.allergenRow}><strong>{common.containsOats}</strong><span>{common.mayContainSoy}</span></div>
          </div>
          <div className={styles.productSignal}><OpenCoreMark /><span>{messages.scoreLabel}</span><strong>{PHASE5A2_FIXTURE.conceptDecisionScore}<small>/100</small></strong><p>{route.state === "partial" ? common.processingUnknown : common.confidence}</p><small>{common.notMedicalAdvice}</small></div>
          <figure className={styles.productPackage}><span>North Grain</span><strong>OAT</strong><small>{common.syntheticDisclosure}</small><figcaption>{common.observedDate}</figcaption></figure>
        </header>
        <div className={styles.productBody}>
          <nav aria-label={messages.productIndex} className={styles.productNav}><span>{messages.productIndex}</span><a href="#product-decision">01 · {messages.depths[0].title}</a><a href="#product-evidence">02 · {messages.depths[1].title}</a><a href="#product-source">03 · {messages.depths[2].title}</a></nav>
          <section className={styles.productEvidence} id="product-evidence"><span>02</span><h2>{messages.evidenceHeading}</h2><EvidenceSequence messages={messages} /></section>
          <aside className={styles.sourceState} id="product-source"><span>03 · {messages.sourceHeading}</span><OpenCoreMark /><ul><li>{messages.sourcePackage}</li><li>{messages.sourceIndependent}</li><li>{messages.sourceProcessing}</li></ul></aside>
        </div>
        <Surface as="div" boundary="strong" className={styles.facts} density="spacious" id="product-detail">
          <Tabs
            activationMode="manual"
            defaultValue={defaultTab}
            label={messages.factsLabel}
            items={[
              { value: "nutrition", label: messages.factsTabs[0], panel: <NutritionTable messages={messages} /> },
              { value: "ingredients", label: messages.factsTabs[1], panel: <p>{messages.ingredientText}</p> },
              { value: "allergens", label: messages.factsTabs[2], panel: <p>{messages.allergenText}</p> },
              { value: "provenance", label: messages.factsTabs[3], panel: <p>{messages.provenanceText}</p> },
            ]}
          />
        </Surface>
        <p className={styles.packageReminder}>{common.packageReminder}</p>
      </article>
    </>
  );
}

function ScannerSurface({ messages, route }: Readonly<{ messages: OpenCoreMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  const initialState = route.state as Parameters<typeof ScannerStudy>[0]["initialState"];
  return (
    <>
      <OpenCoreHeader messages={messages} route={route} />
      <section className={styles.scannerPage}>
        <header><span>{messages.scannerKicker}</span><h1>{messages.scannerTitle}</h1><p>{messages.scannerLead}</p></header>
        <div className={styles.scannerStage}>
          <div aria-hidden="true" className={styles.scanPortal}><i /><i /><i /><OpenCoreMark /><span>{PHASE5A2_FIXTURE.ean}</span></div>
          <div className={styles.scannerPreview} data-phase5a2-fixture-reference=""><span>{messages.scannerResult}</span><h2>{common.fixtureName}</h2><dl><div><dt>{messages.scoreLabel}</dt><dd>{PHASE5A2_FIXTURE.conceptDecisionScore} / 100</dd></div><div><dt>{messages.sourceHeading}</dt><dd>{common.confidence}</dd></div></dl><p>{common.processingUnknown}</p></div>
        </div>
        <ScannerStudy className={styles.scannerControls} copy={common.scanner} direction="open-core" ean={PHASE5A2_FIXTURE.ean} initialState={initialState} />
      </section>
    </>
  );
}

function MotionSurface({ messages, route }: Readonly<{ messages: OpenCoreMessages; route: Phase5A2RouteState }>) {
  const initialStage = route.state === "start" ? 0 : route.state === "mid" ? 1 : 3;
  return (
    <>
      <OpenCoreHeader messages={messages} route={route} />
      <section className={styles.motionPage}>
        <header><span>{messages.motionKicker}</span><h1>{messages.motionTitle}</h1><p>{messages.motionLead}</p></header>
        <div aria-hidden="true" className={styles.motionDiagram}><OpenCoreMark /><i /><i /><i /></div>
        <MotionStudy className={styles.motionControls} copy={messages.motion} direction="open-core" initialStage={initialStage} motionMode={route.motion} />
      </section>
    </>
  );
}

export function OpenCore({ route }: Readonly<{ route: Phase5A2RouteState }>) {
  const messages = OPEN_CORE_MESSAGES[route.locale];
  return (
    <main
      className={styles.root}
      data-design-system="v2"
      data-phase5a2-candidate="open-core"
      data-phase5a2-motion={route.motion}
      data-phase5a2-ready="true"
      data-phase5a2-state={route.state}
      data-phase5a2-surface={route.surface}
      data-theme={route.theme}
      data-ds-overlay-host=""
      id="main-content"
      lang={route.locale}
    >
      {route.surface === "identity" ? <IdentitySurface messages={messages} /> : null}
      {route.surface === "landing" ? <LandingSurface messages={messages} route={route} /> : null}
      {route.surface === "home" ? <HomeSurface messages={messages} route={route} /> : null}
      {route.surface === "product" ? <ProductSurface messages={messages} route={route} /> : null}
      {route.surface === "scanner" ? <ScannerSurface messages={messages} route={route} /> : null}
      {route.surface === "motion" ? <MotionSurface messages={messages} route={route} /> : null}
    </main>
  );
}
