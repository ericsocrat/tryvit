import { Surface } from "@/design-system/primitives/Surface/Surface";
import { Tabs } from "@/design-system/primitives/Tabs";

import { MotionStudy, type MotionStudyCopy } from "@/app/dev/phase5a2/_shared/MotionStudy.client";
import { ProductLookup } from "@/app/dev/phase5a2/_shared/ProductLookup.client";
import { ScannerStudy, type ScannerState } from "@/app/dev/phase5a2/_shared/ScannerStudy.client";
import {
  phase5A2ReviewHref,
  type Phase5A2Locale,
  type Phase5A2RouteState,
} from "@/app/dev/phase5a2/_shared/contract";
import { PHASE5A2_FIXTURE } from "@/app/dev/phase5a2/_shared/fixture";
import { PHASE5A2_COMMON_MESSAGES } from "@/app/dev/phase5a2/_shared/messages";

import styles from "./source-fold.module.css";

interface SourceFoldMessages {
  readonly direction: string;
  readonly navHome: string;
  readonly navEvidence: string;
  readonly navScan: string;
  readonly landingEyebrow: string;
  readonly landingTitle: string;
  readonly landingBody: string;
  readonly primaryAction: string;
  readonly secondaryAction: string;
  readonly landingSpineLabel: string;
  readonly landingSpineTitle: string;
  readonly homeTitle: string;
  readonly homeLead: string;
  readonly productTitle: string;
  readonly productLead: string;
  readonly scannerTitle: string;
  readonly scannerLead: string;
  readonly motionTitle: string;
  readonly homeState: Readonly<Record<"returning" | "new" | "paused" | "error", string>>;
  readonly productState: Readonly<Record<"overview" | "evidence" | "partial", string>>;
  readonly labels: Readonly<Record<SourceFoldLabelKey, string>>;
  readonly spine: readonly {
    readonly label: string;
    readonly kind: string;
    readonly body: string;
  }[];
  readonly motion: MotionStudyCopy;
}

type SourceFoldLabelKey =
  | "identityKicker"
  | "identityDescription"
  | "primaryLockup"
  | "identityTagline"
  | "identityVariants"
  | "palette"
  | "primary"
  | "dark"
  | "monochrome"
  | "micro"
  | "maskable"
  | "character"
  | "characterDescription"
  | "typographyProposal"
  | "typographyDescription"
  | "avoid"
  | "avoidDescription"
  | "status"
  | "statusDescription"
  | "sourceLayer"
  | "reviewDesk"
  | "decision"
  | "sources"
  | "continueReview"
  | "observed"
  | "confidence"
  | "source"
  | "sourceSummary"
  | "currentDecision"
  | "sourceNote"
  | "nutritionPer100ml"
  | "energy"
  | "fatSaturates"
  | "carbohydrateSugars"
  | "fibreProtein"
  | "salt"
  | "derived"
  | "onThisLabel"
  | "evidenceSpine"
  | "fullFacts"
  | "packageCheck"
  | "sourceLedger"
  | "package"
  | "oneTranscription"
  | "independent"
  | "zeroVerifications"
  | "processing"
  | "unconfirmed"
  | "productEvidenceDetail"
  | "nutrition"
  | "ingredients"
  | "ingredientText"
  | "allergens"
  | "allergenUnknown"
  | "provenance"
  | "scannerConcept"
  | "fixtureReference"
  | "motionStudy"
  | "motionLead";

const SOURCE_FOLD_MESSAGES: Readonly<Record<Phase5A2Locale, SourceFoldMessages>> = {
  en: {
    direction: "Source Fold",
    navHome: "Desk",
    navEvidence: "Evidence",
    navScan: "Scan",
    landingEyebrow: "The package becomes the proof",
    landingTitle: "From package text to a decision you can explain.",
    landingBody: "TryVit unfolds a food label into observed facts, a transparent calculation, context, and a decision that remains yours.",
    primaryAction: "Unfold the review fixture",
    secondaryAction: "Read the evidence method",
    landingSpineLabel: "One source · four layers",
    landingSpineTitle: "Keep the evidence attached.",
    homeTitle: "Your evidence desk",
    homeLead: "Continue one decision with its source still attached.",
    productTitle: "A label dossier, not a verdict",
    productLead: "What the package says, what the concept calculates, and what remains unknown stay in one reading order.",
    scannerTitle: "Decode the label, keep the source",
    scannerLead: "A deterministic scanner study using one synthetic package. No camera is active.",
    motionTitle: "The source unfolds into evidence",
    homeState: {
      returning: "Continue the fixed review from its last evidence layer.",
      new: "No review has started; the synthetic fixture is ready.",
      paused: "This review is paused; its source remains attached.",
      error: "The live source is unavailable. Only the fixed review fixture is shown.",
    },
    productState: {
      overview: "Decision overview",
      evidence: "Evidence layer in focus",
      partial: "Partial evidence; processing remains unconfirmed",
    },
    labels: {
      identityKicker: "Candidate A · preliminary geometry",
      identityDescription: "An editorial identity that keeps the package source attached as evidence unfolds.",
      primaryLockup: "Primary identity lockup",
      identityTagline: "source → evidence → decision",
      identityVariants: "Identity variants",
      palette: "Source Fold palette",
      primary: "Primary · 64", dark: "Dark", monochrome: "Monochrome", micro: "Micro · 16", maskable: "Maskable study",
      character: "Character", characterDescription: "Editorial warmth · tactile label planes · explicit provenance.",
      typographyProposal: "Typography proposal", typographyDescription: "Manrope + Source Serif 4. System-stack approximation here; no font adopted.",
      avoid: "Do not", avoidDescription: "Close the source node, restore a leaf, add a gradient, or use green as health status.",
      status: "Status", statusDescription: "Working codename. Preliminary vector. Not name- or trademark-cleared.",
      sourceLayer: "source", reviewDesk: "Review desk", decision: "Decision", sources: "Sources", continueReview: "Continue review",
      observed: "Observed", confidence: "Confidence", source: "Source", sourceSummary: "1 package · 0 verified",
      currentDecision: "Current decision", sourceNote: "Source note",
      nutritionPer100ml: "Nutrition per 100 ml", energy: "Energy", fatSaturates: "Fat / saturates", carbohydrateSugars: "Carbohydrate / sugars", fibreProtein: "Fibre / protein", salt: "Salt",
      derived: "Derived", onThisLabel: "On this label", evidenceSpine: "Evidence spine", fullFacts: "Full facts", packageCheck: "Package check", sourceLedger: "Source ledger",
      package: "Package", oneTranscription: "1 transcription", independent: "Independent", zeroVerifications: "0 verifications", processing: "Processing", unconfirmed: "Unconfirmed",
      productEvidenceDetail: "Product evidence detail", nutrition: "Nutrition", ingredients: "Ingredients", ingredientText: "Oat-base package transcription for review only. Full ingredient verification is unavailable.",
      allergens: "Allergens", allergenUnknown: "All other allergen evidence is unavailable.", provenance: "Provenance",
      scannerConcept: "Scanner concept · no camera", fixtureReference: "Fixed fixture reference", motionStudy: "Motion study · 0/120/180/240/360/500ms", motionLead: "Transform and opacity only. Every fact is present before movement begins.",
    },
    spine: [
      { label: "Observed", kind: "Direct", body: "Package transcription dated 14 July 2026. Contains oats; may contain soy." },
      { label: "Calculated", kind: "Derived", body: "Concept decision score: 72 out of 100, from this closed review fixture." },
      { label: "Contextualized", kind: "Interpretive", body: "Moderate confidence. One package transcription, no independent verification; processing classification unconfirmed." },
      { label: "Decision", kind: "Action", body: "Compare the evidence and check the current package before deciding." },
    ],
    motion: {
      stages: [
        { id: "label", label: "Package label", description: "The observed source remains intact." },
        { id: "decode", label: "Decoded facts", description: "Nutrition and allergen facts unfold without changing meaning." },
        { id: "context", label: "Evidence context", description: "Confidence and unknowns join the calculation." },
        { id: "decision", label: "Decision", description: "The final action returns to the current package." },
      ],
      previous: "Previous fold",
      next: "Next fold",
      restart: "Restart study",
    },
  },
  pl: {
    direction: "Source Fold",
    navHome: "Biurko",
    navEvidence: "Dowody",
    navScan: "Skanuj",
    landingEyebrow: "Opakowanie staje się dowodem",
    landingTitle: "Od tekstu na opakowaniu do decyzji, którą można wyjaśnić.",
    landingBody: "TryVit rozkłada etykietę na zaobserwowane fakty, przejrzyste obliczenie, kontekst oraz decyzję, która nadal należy do Ciebie.",
    primaryAction: "Rozłóż materiał testowy",
    secondaryAction: "Poznaj metodę dowodową",
    landingSpineLabel: "Jedno źródło · cztery warstwy",
    landingSpineTitle: "Zachowaj połączenie ze źródłem.",
    homeTitle: "Twoje biurko dowodowe",
    homeLead: "Kontynuuj jedną decyzję z nadal dołączonym źródłem.",
    productTitle: "Teczka etykiety, nie werdykt",
    productLead: "Treść opakowania, obliczenie koncepcyjne i niewiadome pozostają w jednej kolejności czytania.",
    scannerTitle: "Odczytaj etykietę i zachowaj źródło",
    scannerLead: "Deterministyczna koncepcja skanera z jednym syntetycznym opakowaniem. Aparat nie jest aktywny.",
    motionTitle: "Źródło rozkłada się w dowód",
    homeState: {
      returning: "Kontynuuj stały przegląd od ostatniej warstwy dowodowej.",
      new: "Przegląd nie został rozpoczęty; materiał syntetyczny jest gotowy.",
      paused: "Przegląd jest wstrzymany; źródło pozostaje dołączone.",
      error: "Źródło na żywo jest niedostępne. Widoczny jest tylko stały materiał testowy.",
    },
    productState: {
      overview: "Przegląd decyzji",
      evidence: "Warstwa dowodowa w centrum",
      partial: "Częściowe dowody; przetworzenie pozostaje niepotwierdzone",
    },
    labels: {
      identityKicker: "Kandydat A · geometria wstępna",
      identityDescription: "Redakcyjna tożsamość, która zachowuje połączenie dowodów ze źródłem na opakowaniu.",
      primaryLockup: "Podstawowy układ znaku", identityTagline: "źródło → dowody → decyzja", identityVariants: "Warianty tożsamości",
      palette: "Paleta Source Fold",
      primary: "Podstawowy · 64", dark: "Ciemny", monochrome: "Monochromatyczny", micro: "Mikro · 16", maskable: "Wariant maskowalny",
      character: "Charakter", characterDescription: "Redakcyjne ciepło · dotykowe płaszczyzny etykiety · jawne pochodzenie.",
      typographyProposal: "Propozycja typografii", typographyDescription: "Manrope + Source Serif 4. Tutaj przybliżenie stosem systemowym; nie wdrożono fontu.",
      avoid: "Nie należy", avoidDescription: "Zamykać węzła źródła, przywracać liścia, dodawać gradientu ani używać zieleni jako oceny zdrowia.",
      status: "Status", statusDescription: "Robocza nazwa. Wstępny wektor. Bez weryfikacji nazwy i znaków towarowych.",
      sourceLayer: "źródło", reviewDesk: "Biurko przeglądu", decision: "Decyzja", sources: "Źródła", continueReview: "Kontynuuj przegląd",
      observed: "Zaobserwowano", confidence: "Pewność", source: "Źródło", sourceSummary: "1 opakowanie · 0 weryfikacji",
      currentDecision: "Bieżąca decyzja", sourceNote: "Nota źródłowa",
      nutritionPer100ml: "Wartości odżywcze w 100 ml", energy: "Energia", fatSaturates: "Tłuszcz / nasycone", carbohydrateSugars: "Węglowodany / cukry", fibreProtein: "Błonnik / białko", salt: "Sól",
      derived: "Pochodne", onThisLabel: "Na tej etykiecie", evidenceSpine: "Oś dowodowa", fullFacts: "Pełne dane", packageCheck: "Kontrola opakowania", sourceLedger: "Rejestr źródeł",
      package: "Opakowanie", oneTranscription: "1 transkrypcja", independent: "Niezależne", zeroVerifications: "0 weryfikacji", processing: "Przetworzenie", unconfirmed: "Niepotwierdzone",
      productEvidenceDetail: "Szczegóły dowodów produktu", nutrition: "Wartości odżywcze", ingredients: "Składniki", ingredientText: "Transkrypcja bazy owsianej wyłącznie do przeglądu. Pełna weryfikacja składników jest niedostępna.",
      allergens: "Alergeny", allergenUnknown: "Dowody dotyczące pozostałych alergenów są niedostępne.", provenance: "Pochodzenie",
      scannerConcept: "Koncepcja skanera · bez aparatu", fixtureReference: "Stały materiał referencyjny", motionStudy: "Studium ruchu · 0/120/180/240/360/500 ms", motionLead: "Zmieniają się tylko położenie i przezroczystość. Wszystkie fakty są obecne przed rozpoczęciem ruchu.",
    },
    spine: [
      { label: "Zaobserwowane", kind: "Bezpośrednie", body: "Transkrypcja opakowania z 14 lipca 2026. Zawiera owies; może zawierać soję." },
      { label: "Obliczone", kind: "Pochodne", body: "Koncepcyjny wynik decyzji: 72 na 100, wyłącznie dla tego materiału testowego." },
      { label: "Umieszczone w kontekście", kind: "Interpretacyjne", body: "Umiarkowana pewność. Jedno opakowanie, bez niezależnej weryfikacji; klasyfikacja przetworzenia niepotwierdzona." },
      { label: "Decyzja", kind: "Działanie", body: "Porównaj dowody i sprawdź aktualne opakowanie przed podjęciem decyzji." },
    ],
    motion: {
      stages: [
        { id: "label", label: "Etykieta", description: "Zaobserwowane źródło pozostaje nienaruszone." },
        { id: "decode", label: "Odczytane fakty", description: "Dane żywieniowe i alergeny rozwijają się bez zmiany znaczenia." },
        { id: "context", label: "Kontekst dowodowy", description: "Pewność i niewiadome dołączają do obliczenia." },
        { id: "decision", label: "Decyzja", description: "Końcowe działanie prowadzi z powrotem do aktualnego opakowania." },
      ],
      previous: "Poprzednia warstwa",
      next: "Następna warstwa",
      restart: "Uruchom ponownie",
    },
  },
  de: {
    direction: "Source Fold",
    navHome: "Arbeitsplatz",
    navEvidence: "Evidenz",
    navScan: "Scannen",
    landingEyebrow: "Die Verpackung wird zum Beleg",
    landingTitle: "Vom Verpackungstext zu einer Entscheidung, die nachvollziehbar bleibt.",
    landingBody: "TryVit entfaltet ein Lebensmitteletikett in beobachtete Fakten, eine transparente Berechnung, den notwendigen Kontext und eine Entscheidung, die bei Ihnen bleibt.",
    primaryAction: "Prüfmuster entfalten",
    secondaryAction: "Evidenzmethode lesen",
    landingSpineLabel: "Eine Quelle · vier Ebenen",
    landingSpineTitle: "Die Quelle bleibt mit der Evidenz verbunden.",
    homeTitle: "Ihr Evidenzarbeitsplatz",
    homeLead: "Setzen Sie eine Entscheidung fort, ohne die Quelle vom Ergebnis zu trennen.",
    productTitle: "Ein Etikettendossier, kein Urteil",
    productLead: "Verpackungsangaben, konzeptionelle Berechnung und offene Fragen bleiben in einer durchgehenden Lesereihenfolge sichtbar.",
    scannerTitle: "Etikett entschlüsseln, Quelle bewahren",
    scannerLead: "Eine deterministische Scannerstudie mit einer synthetischen Verpackung. Keine Kamera ist aktiv.",
    motionTitle: "Die Quelle entfaltet sich zur Evidenz",
    homeState: {
      returning: "Setzen Sie das feste Prüfmuster an der letzten Evidenzebene fort.",
      new: "Noch keine Prüfung begonnen; das synthetische Prüfmuster ist bereit.",
      paused: "Die Prüfung ist pausiert; ihre Quelle bleibt verbunden.",
      error: "Die Live-Quelle ist nicht verfügbar. Nur das feste Prüfmuster wird angezeigt.",
    },
    productState: {
      overview: "Entscheidungsübersicht",
      evidence: "Evidenzebene im Fokus",
      partial: "Teilweise Evidenz; Verarbeitung bleibt unbestätigt",
    },
    labels: {
      identityKicker: "Kandidat A · vorläufige Geometrie",
      identityDescription: "Eine redaktionelle Identität, die die Verpackungsquelle beim Entfalten der Evidenz verbunden hält.",
      primaryLockup: "Primäre Logokombination", identityTagline: "Quelle → Evidenz → Entscheidung", identityVariants: "Identitätsvarianten",
      palette: "Source-Fold-Farbpalette",
      primary: "Primär · 64", dark: "Dunkel", monochrome: "Monochrom", micro: "Mikro · 16", maskable: "Maskierbare Studie",
      character: "Charakter", characterDescription: "Redaktionelle Wärme · haptische Etikettflächen · explizite Herkunft.",
      typographyProposal: "Typografievorschlag", typographyDescription: "Manrope + Source Serif 4. Hier als Systemschrift-Annäherung; keine Schrift übernommen.",
      avoid: "Vermeiden", avoidDescription: "Den Quellknoten schließen, das Blatt wiederherstellen, Verläufe hinzufügen oder Grün als Gesundheitsnote verwenden.",
      status: "Status", statusDescription: "Arbeitsname. Vorläufiger Vektor. Name und Markenrechte nicht geprüft.",
      sourceLayer: "Quelle", reviewDesk: "Prüfarbeitsplatz", decision: "Entscheidung", sources: "Quellen", continueReview: "Prüfung fortsetzen",
      observed: "Beobachtet", confidence: "Verlässlichkeit", source: "Quelle", sourceSummary: "1 Verpackung · 0 Prüfungen",
      currentDecision: "Aktuelle Entscheidung", sourceNote: "Quellenhinweis",
      nutritionPer100ml: "Nährwerte je 100 ml", energy: "Energie", fatSaturates: "Fett / gesättigte Fettsäuren", carbohydrateSugars: "Kohlenhydrate / Zucker", fibreProtein: "Ballaststoffe / Eiweiß", salt: "Salz",
      derived: "Abgeleitet", onThisLabel: "Auf diesem Etikett", evidenceSpine: "Evidenzachse", fullFacts: "Vollständige Daten", packageCheck: "Verpackungsprüfung", sourceLedger: "Quellenregister",
      package: "Verpackung", oneTranscription: "1 Abschrift", independent: "Unabhängig", zeroVerifications: "0 Überprüfungen", processing: "Verarbeitung", unconfirmed: "Unbestätigt",
      productEvidenceDetail: "Produkt- und Evidenzdetails", nutrition: "Nährwerte", ingredients: "Zutaten", ingredientText: "Haferbasis-Abschrift nur für die Prüfung. Eine vollständige Zutatenprüfung ist nicht verfügbar.",
      allergens: "Allergene", allergenUnknown: "Evidenz zu allen weiteren Allergenen ist nicht verfügbar.", provenance: "Herkunft",
      scannerConcept: "Scannerkonzept · ohne Kamera", fixtureReference: "Festes Prüfmuster", motionStudy: "Bewegungsstudie · 0/120/180/240/360/500 ms", motionLead: "Nur Position und Deckkraft ändern sich. Alle Fakten sind vor Beginn der Bewegung vorhanden.",
    },
    spine: [
      { label: "Beobachtet", kind: "Direkt", body: "Verpackungsabschrift vom 14. Juli 2026. Enthält Hafer; kann Soja enthalten." },
      { label: "Berechnet", kind: "Abgeleitet", body: "Konzeptionelles Entscheidungsergebnis: 72 von 100, ausschließlich aus diesem Prüfmuster." },
      { label: "In Kontext gesetzt", kind: "Interpretativ", body: "Mittlere Verlässlichkeit. Eine Verpackungsabschrift, keine unabhängige Überprüfung; Verarbeitungsklassifikation unbestätigt." },
      { label: "Entscheidung", kind: "Handlung", body: "Vergleichen Sie die Evidenz und prüfen Sie vor der Entscheidung die aktuelle Verpackung." },
    ],
    motion: {
      stages: [
        { id: "label", label: "Verpackungsetikett", description: "Die beobachtete Quelle bleibt vollständig erhalten." },
        { id: "decode", label: "Entschlüsselte Fakten", description: "Nährwerte und Allergene entfalten sich, ohne ihre Bedeutung zu verändern." },
        { id: "context", label: "Evidenzkontext", description: "Verlässlichkeit und offene Fragen ergänzen die Berechnung." },
        { id: "decision", label: "Entscheidung", description: "Die abschließende Handlung führt zur aktuellen Verpackung zurück." },
      ],
      previous: "Vorherige Faltung",
      next: "Nächste Faltung",
      restart: "Studie neu starten",
    },
  },
};

function SourceFoldMark({ className = "", micro = false }: Readonly<{ className?: string; micro?: boolean }>) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 64 64">
      {micro ? (
        <>
          <path d="M9 17H35L49 31V50H23L9 36Z" />
          <path clipRule="evenodd" d="M24 10H44L55 21V41L46 50H24V31L35 20L24 10ZM45 16a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z" fillRule="evenodd" />
        </>
      ) : (
        <>
          <path className={styles.markBack} d="M7 15H36L51 30V52H23L7 36Z" />
          <path className={styles.markFront} clipRule="evenodd" d="M22 8H45L57 20V43L46 54H22V31L34 19L22 8ZM46 15a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z" fillRule="evenodd" />
        </>
      )}
    </svg>
  );
}

function SourceFoldHeader({
  route,
  messages,
}: Readonly<{ route: Phase5A2RouteState; messages: SourceFoldMessages }>) {
  return (
    <header className={styles.header}>
      <a className={styles.brand} href={phase5A2ReviewHref("source-fold", "landing", route.locale, route.theme, route.motion)}>
        <SourceFoldMark />
        <span>TryVit</span>
      </a>
      <nav aria-label={PHASE5A2_COMMON_MESSAGES[route.locale].navigationLabel}>
        <a href={phase5A2ReviewHref("source-fold", "home", route.locale, route.theme, route.motion)}>{messages.navHome}</a>
        <a href={phase5A2ReviewHref("source-fold", "product", route.locale, route.theme, route.motion)}>{messages.navEvidence}</a>
        <a href={phase5A2ReviewHref("source-fold", "scanner", route.locale, route.theme, route.motion)}>{messages.navScan}</a>
      </nav>
      <span className={styles.directionLabel}>{messages.direction} · A</span>
    </header>
  );
}

function EvidenceSpine({ messages, compact = false }: Readonly<{ messages: SourceFoldMessages; compact?: boolean }>) {
  return (
    <ol className={compact ? styles.spineCompact : styles.spine}>
      {messages.spine.map((stage, index) => (
        <li key={stage.label}>
          <span className={styles.stageNumber}>{String(index + 1).padStart(2, "0")}</span>
          <div className={styles.stageHeading}>
            <h3>{stage.label}</h3>
            <span>{stage.kind}</span>
          </div>
          <p>{stage.body}</p>
        </li>
      ))}
    </ol>
  );
}

function IdentitySurface({ messages }: Readonly<{ messages: SourceFoldMessages }>) {
  const { labels } = messages;
  return (
    <div className={styles.identityBoard}>
      <header className={styles.identityIntro}>
        <div><span>{labels.identityKicker}</span><h1>Source Fold</h1></div>
        <p>{labels.identityDescription}</p>
      </header>
      <section className={styles.identityHero} aria-label={labels.primaryLockup}>
        <SourceFoldMark className={styles.identityMark} />
        <div><strong>TryVit</strong><span>{labels.identityTagline}</span></div>
      </section>
      <section className={styles.identityRail} aria-label={labels.identityVariants}>
        <figure><SourceFoldMark /><figcaption>{labels.primary}</figcaption></figure>
        <figure className={styles.darkSpecimen}><SourceFoldMark /><figcaption>{labels.dark}</figcaption></figure>
        <figure className={styles.monoSpecimen}><SourceFoldMark /><figcaption>{labels.monochrome}</figcaption></figure>
        <figure><SourceFoldMark micro /><figcaption>{labels.micro}</figcaption></figure>
        <figure className={styles.maskSpecimen}><SourceFoldMark /><figcaption>{labels.maskable}</figcaption></figure>
      </section>
      <section className={styles.identityDetails}>
        <div><span>{labels.character}</span><p>{labels.characterDescription}</p></div>
        <div><span>{labels.typographyProposal}</span><p>{labels.typographyDescription}</p></div>
        <div><span>{labels.avoid}</span><p>{labels.avoidDescription}</p></div>
        <div><span>{labels.status}</span><p>{labels.statusDescription}</p></div>
      </section>
      <div className={styles.palette} aria-label={labels.palette}><span /><span /><span /><span /><span /></div>
    </div>
  );
}

function LandingSurface({ messages, route }: Readonly<{ messages: SourceFoldMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  return (
    <>
      <SourceFoldHeader messages={messages} route={route} />
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{messages.landingEyebrow}</span>
          <h1>{messages.landingTitle}</h1>
          <p>{messages.landingBody}</p>
          <div className={styles.heroActions}>
            <a href="#source-fold-evidence">{messages.primaryAction}</a>
            <a href="#source-fold-method">{messages.secondaryAction}</a>
          </div>
          <small>{common.syntheticDisclosure} · {common.notMedicalAdvice}</small>
        </div>
        <figure className={styles.decodeFigure}>
          <div className={styles.packagePlane} aria-hidden="true"><span>NG</span><i /><i /><i /></div>
          <div className={styles.decodedLabel}>
            <span>01 · {messages.labels.sourceLayer}</span>
            <strong>{common.fixtureName}</strong>
            <p>{common.conceptScore}</p>
            <p>{common.confidence}</p>
          </div>
          <figcaption>{common.syntheticDisclosure}</figcaption>
        </figure>
      </section>
      <section className={styles.landingSpine} id="source-fold-evidence">
        <header><span>{messages.landingSpineLabel}</span><h2 id="source-fold-method">{messages.landingSpineTitle}</h2></header>
        <EvidenceSpine messages={messages} compact />
      </section>
    </>
  );
}

function HomeSurface({ messages, route }: Readonly<{ messages: SourceFoldMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  const state = route.state as keyof SourceFoldMessages["homeState"];
  const { labels } = messages;
  return (
    <div className={styles.appFrame}>
      <SourceFoldHeader messages={messages} route={route} />
      <nav className={styles.appRail} aria-label={labels.reviewDesk}><strong>TV</strong><a aria-current="location" href="#decision">{labels.decision}</a><a href="#source">{labels.sources}</a></nav>
      <section className={styles.homeWorkspace}>
        <header><span>{common.syntheticDisclosure}</span><h1>{messages.homeTitle}</h1><p>{messages.homeLead}</p><small>{messages.homeState[state]}</small></header>
        <div className={styles.homeSearch}>
          <ProductLookup
            copy={common.productLookup}
            ean={PHASE5A2_FIXTURE.ean}
            fixtureName={common.fixtureName}
          />
        </div>
        <a className={styles.continueRow} href={phase5A2ReviewHref("source-fold", "product", route.locale, route.theme, route.motion)}>
          <div><span>{labels.continueReview}</span><strong>{common.fixtureName}</strong></div>
          <dl><div><dt>{labels.observed}</dt><dd>14·07·2026</dd></div><div><dt>{labels.confidence}</dt><dd>{common.confidence}</dd></div><div><dt>{labels.source}</dt><dd>{labels.sourceSummary}</dd></div></dl>
        </a>
        <section className={styles.homeEvidence} id="decision"><h2>{labels.currentDecision}</h2><EvidenceSpine messages={messages} compact /></section>
        <aside className={styles.sourceNote} id="source"><span>{labels.sourceNote}</span><p>{common.confidenceExplanation} {common.processingUnknown}</p></aside>
      </section>
    </div>
  );
}

function NutritionTable({ labels }: Readonly<{ labels: SourceFoldMessages["labels"] }>) {
  return (
    <table className={styles.nutritionTable}>
      <caption>{labels.nutritionPer100ml}</caption>
      <tbody>
        <tr><th scope="row">{labels.energy}</th><td>193 kJ / 46 kcal</td></tr>
        <tr><th scope="row">{labels.fatSaturates}</th><td>1.5 g / 0.2 g</td></tr>
        <tr><th scope="row">{labels.carbohydrateSugars}</th><td>7.4 g / 3.2 g</td></tr>
        <tr><th scope="row">{labels.fibreProtein}</th><td>0.8 g / 1.0 g</td></tr>
        <tr><th scope="row">{labels.salt}</th><td>0.10 g</td></tr>
      </tbody>
    </table>
  );
}

function ProductSurface({ messages, route }: Readonly<{ messages: SourceFoldMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  const state = route.state as keyof SourceFoldMessages["productState"];
  const { labels } = messages;
  const defaultTab = route.state === "evidence" ? "provenance" : "nutrition";
  return (
    <>
      <SourceFoldHeader messages={messages} route={route} />
      <article className={styles.product}>
        <header className={styles.productMasthead}>
          <figure className={styles.productPackage}><span>North Grain</span><strong>OAT</strong><small>{common.syntheticDisclosure}</small></figure>
          <div className={styles.productIdentity}><span>{common.observedDate}</span><h1>{common.fixtureName}</h1><p>{messages.productLead}</p><small>{messages.productState[state]}</small><div className={styles.allergens}><strong>{common.containsOats}</strong><span>{common.mayContainSoy}</span></div></div>
          <div className={styles.scoreFold}><span>{labels.derived}</span><strong>72<small>/100</small></strong><p>{common.confidence}</p><small>{common.notMedicalAdvice}</small></div>
        </header>
        <div className={styles.productGrid}>
          <nav aria-label={labels.onThisLabel} className={styles.productIndex}><span>{labels.onThisLabel}</span><a href="#evidence-spine">{labels.evidenceSpine}</a><a href="#product-detail">{labels.fullFacts}</a><a href="#package-check">{labels.packageCheck}</a></nav>
          <section className={styles.dossier} id="evidence-spine"><h2>{messages.productTitle}</h2><EvidenceSpine messages={messages} /></section>
          <aside className={styles.ledger}><span>{labels.sourceLedger}</span><dl><div><dt>{labels.package}</dt><dd>{labels.oneTranscription}</dd></div><div><dt>{labels.independent}</dt><dd>{labels.zeroVerifications}</dd></div><div><dt>{labels.processing}</dt><dd>{labels.unconfirmed}</dd></div></dl></aside>
        </div>
        <Surface as="div" boundary="strong" className={styles.productDetail} density="spacious" id="product-detail">
          <Tabs
            activationMode="manual"
            defaultValue={defaultTab}
            label={labels.productEvidenceDetail}
            items={[
              { value: "nutrition", label: labels.nutrition, panel: <NutritionTable labels={labels} /> },
              { value: "ingredients", label: labels.ingredients, panel: <p>{labels.ingredientText}</p> },
              { value: "allergens", label: labels.allergens, panel: <p>{common.containsOats}. {common.mayContainSoy}. {labels.allergenUnknown}</p> },
              { value: "provenance", label: labels.provenance, panel: <p>{common.observedDate}. {common.confidenceExplanation}</p> },
            ]}
          />
        </Surface>
        <p className={styles.packageReminder} id="package-check">{common.packageReminder}</p>
      </article>
    </>
  );
}

function ScannerSurface({ messages, route }: Readonly<{ messages: SourceFoldMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  return (
    <>
      <SourceFoldHeader messages={messages} route={route} />
      <section className={styles.scannerPage}>
        <header><span>{messages.labels.scannerConcept}</span><h1>{messages.scannerTitle}</h1><p>{messages.scannerLead}</p></header>
        <div className={styles.scannerGrid}>
          <div className={styles.scanViewport} aria-hidden="true"><div className={styles.scanCorners} /><SourceFoldMark /><span>{PHASE5A2_FIXTURE.ean}</span></div>
          <div className={styles.scannerResult}><span>{messages.labels.fixtureReference}</span><h2>{common.fixtureName}</h2><p>{common.confidence}</p><p>{common.processingUnknown}</p><strong>{common.conceptScore}</strong></div>
        </div>
        <ScannerStudy className={styles.scannerControls} copy={common.scanner} direction="source-fold" ean={PHASE5A2_FIXTURE.ean} initialState={route.state as ScannerState} />
      </section>
    </>
  );
}

function MotionSurface({ messages, route }: Readonly<{ messages: SourceFoldMessages; route: Phase5A2RouteState }>) {
  const initialStage = route.state === "start" ? 0 : route.state === "mid" ? 1 : 3;
  return (
    <>
      <SourceFoldHeader messages={messages} route={route} />
      <section className={styles.motionPage}><header><span>{messages.labels.motionStudy}</span><h1>{messages.motionTitle}</h1><p>{messages.labels.motionLead}</p></header><div className={styles.motionMark}><SourceFoldMark /><i /><i /></div><MotionStudy className={styles.motionControls} copy={messages.motion} direction="source-fold" initialStage={initialStage} motionMode={route.motion} /></section>
    </>
  );
}

export function SourceFold({ route }: Readonly<{ route: Phase5A2RouteState }>) {
  const messages = SOURCE_FOLD_MESSAGES[route.locale];
  return (
    <main
      className={styles.root}
      data-design-system="v2"
      data-phase5a2-candidate="source-fold"
      data-phase5a2-motion={route.motion}
      data-phase5a2-ready="true"
      data-phase5a2-state={route.state}
      data-phase5a2-surface={route.surface}
      data-ds-overlay-host=""
      data-theme={route.theme}
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
