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

import styles from "./evidence-register.module.css";

interface EvidenceRegisterMessages {
  readonly direction: string;
  readonly navigation: readonly [string, string, string];
  readonly identity: readonly [string, string, string, string, string];
  readonly landingEyebrow: string;
  readonly landingTitle: string;
  readonly landingBody: string;
  readonly primaryAction: string;
  readonly secondaryAction: string;
  readonly homeTitle: string;
  readonly homeLead: string;
  readonly homeState: Readonly<Record<"returning" | "new" | "paused" | "error", string>>;
  readonly productTitle: string;
  readonly productLead: string;
  readonly productState: Readonly<Record<"overview" | "evidence" | "partial", string>>;
  readonly scannerTitle: string;
  readonly scannerLead: string;
  readonly motionTitle: string;
  readonly motionLead: string;
  readonly register: readonly {
    readonly code: string;
    readonly label: string;
    readonly kind: string;
    readonly body: string;
  }[];
  readonly labels: Readonly<{
    sourceRegister: string;
    currentRecord: string;
    continueReview: string;
    observed: string;
    confidence: string;
    sourceCount: string;
    packageSource: string;
    independentSource: string;
    processing: string;
    direct: string;
    derived: string;
    unresolved: string;
    recordIndex: string;
    evidenceRegister: string;
    fullFacts: string;
    packageCheck: string;
    sourceLedger: string;
    oneTranscription: string;
    zeroVerifications: string;
    unconfirmed: string;
    scannerConcept: string;
    readSequence: string;
    motionStudy: string;
    identityVariants: string;
    identityKicker: string;
    identityPrimaryLockup: string;
    identityTagline: string;
    identityCharacter: string;
    identityTypography: string;
    identityDoNot: string;
    identityStatus: string;
    identityPalette: string;
    primary: string;
    dark: string;
    monochrome: string;
    micro: string;
    maskable: string;
    nutrition: string;
    ingredients: string;
    allergens: string;
    provenance: string;
    productEvidenceDetail: string;
    ingredientsUnavailable: string;
    allergenEvidenceUnavailable: string;
    record: string;
  }>;
  readonly nutrition: Readonly<{
    caption: string;
    rows: readonly (readonly [string, string])[];
  }>;
  readonly motion: MotionStudyCopy;
}

const EVIDENCE_REGISTER_MESSAGES: Readonly<Record<Phase5A2Locale, EvidenceRegisterMessages>> = {
  en: {
    direction: "Evidence Register",
    navigation: ["Records", "Evidence", "Read"],
    identity: [
      "An open record for decisions that can be checked line by line.",
      "Precise register · ruled evidence · explicit source marker.",
      "IBM Plex Sans + IBM Plex Mono. System-stack approximation here; no font adopted.",
      "Do not close the document, remove the source dot, round the frame, or turn copper into a health grade.",
      "Working codename and preliminary vector. No name or trademark clearance is claimed.",
    ],
    landingEyebrow: "A decision should leave a record",
    landingTitle: "Read the evidence. Check every step.",
    landingBody: "TryVit registers what was observed, what was calculated, what context changes the reading, and what still needs your judgment.",
    primaryAction: "Open the review record",
    secondaryAction: "Inspect the method",
    homeTitle: "Decision register",
    homeLead: "One product, one source trail, and every uncertainty kept on the page.",
    homeState: {
      returning: "Returning to the latest synthetic record.",
      new: "No prior decisions. Start with the synthetic fixture below.",
      paused: "This review is paused; its source trail remains intact.",
      error: "The live source is unavailable. Only the fixed review record is shown.",
    },
    productTitle: "A checkable record, not a final verdict",
    productLead: "Direct observations, derived output, and unresolved context are separated before the decision line.",
    productState: {
      overview: "Overview record",
      evidence: "Evidence register in focus",
      partial: "Partial record: processing classification remains unconfirmed",
    },
    scannerTitle: "Register the code before the\u00a0conclusion",
    scannerLead: "A deterministic scanner concept for one synthetic barcode. No camera or network is used.",
    motionTitle: "A record assembles in reading order",
    motionLead: "Rules and entries appear in sequence; no evidence depends on motion.",
    register: [
      { code: "OBS", label: "Observed", kind: "Direct", body: "Package transcription dated 14 July 2026. Contains oats; may contain soy." },
      { code: "CAL", label: "Calculated", kind: "Derived", body: "Concept decision score: 72 out of 100, calculated only from this closed fixture." },
      { code: "CTX", label: "Context", kind: "Interpretive", body: "Moderate confidence. One package transcription, no independent verification; processing remains unconfirmed." },
      { code: "DEC", label: "Decision", kind: "Action", body: "Use the record to compare, then check the current package before deciding." },
    ],
    labels: {
      sourceRegister: "Source register", currentRecord: "Current record", continueReview: "Continue review",
      observed: "Observed", confidence: "Confidence", sourceCount: "Sources", packageSource: "Package",
      independentSource: "Independent", processing: "Processing", direct: "Direct", derived: "Derived",
      unresolved: "Unresolved", recordIndex: "Record index", evidenceRegister: "Evidence register",
      fullFacts: "Full facts", packageCheck: "Package check", sourceLedger: "Source ledger",
      oneTranscription: "1 transcription", zeroVerifications: "0 verifications", unconfirmed: "Unconfirmed",
      scannerConcept: "Scanner concept · no camera", readSequence: "Fixed fixture reference", motionStudy: "Motion study · fixed timing",
      identityKicker: "Candidate B · preliminary geometry", identityPrimaryLockup: "Primary identity lockup",
      identityTagline: "observe / calculate / contextualize / decide", identityCharacter: "Character",
      identityTypography: "Typography proposal", identityDoNot: "Do not", identityStatus: "Status",
      identityPalette: "Evidence Register palette",
      identityVariants: "Identity variants", primary: "Primary", dark: "Dark", monochrome: "Monochrome",
      micro: "Micro · 16", maskable: "Maskable study", nutrition: "Nutrition", ingredients: "Ingredients",
      allergens: "Allergens", provenance: "Provenance", productEvidenceDetail: "Product evidence detail",
      ingredientsUnavailable: "Oat base transcription for review only. Full ingredient verification is unavailable.",
      allergenEvidenceUnavailable: "All other allergen evidence is unavailable.",
      record: "RECORD",
    },
    nutrition: {
      caption: "Nutrition per 100 ml",
      rows: [["Energy", "193 kJ / 46 kcal"], ["Fat / saturates", "1.5 g / 0.2 g"], ["Carbohydrate / sugars", "7.4 g / 3.2 g"], ["Fibre / protein", "0.8 g / 1.0 g"], ["Salt", "0.10 g"]],
    },
    motion: {
      stages: [
        { id: "source", label: "Source entered", description: "The package transcription opens the record." },
        { id: "facts", label: "Facts ruled", description: "Observed nutrition and allergens occupy fixed rows." },
        { id: "context", label: "Context noted", description: "Confidence and unknowns are attached to the calculation." },
        { id: "decision", label: "Decision filed", description: "The record ends with a package check, not an absolute verdict." },
      ],
      previous: "Previous entry", next: "Next entry", restart: "Restart study",
    },
  },
  pl: {
    direction: "Evidence Register",
    navigation: ["Rejestry", "Dowody", "Odczyt"],
    identity: [
      "Otwarty rejestr decyzji, które można sprawdzić wiersz po wierszu.",
      "Precyzyjny rejestr · liniowane dowody · wyraźny znacznik źródła.",
      "IBM Plex Sans + IBM Plex Mono. Tutaj jako przybliżenie krojami systemowymi; nie przyjęto żadnego kroju pisma.",
      "Nie zamykaj dokumentu, nie usuwaj punktu źródłowego, nie zaokrąglaj ramy i nie zmieniaj miedzi w ocenę zdrowia.",
      "Robocza nazwa i wstępny wektor. Bez deklaracji weryfikacji nazwy lub znaku towarowego.",
    ],
    landingEyebrow: "Decyzja powinna zostawić ślad",
    landingTitle: "Przeczytaj dowody. Sprawdź każdy krok.",
    landingBody: "TryVit rejestruje to, co zaobserwowano, obliczono i osadzono w kontekście — oraz to, co nadal wymaga Twojej oceny.",
    primaryAction: "Otwórz rejestr testowy",
    secondaryAction: "Sprawdź metodę",
    homeTitle: "Rejestr decyzji",
    homeLead: "Jeden produkt, jeden ślad źródłowy i każda niepewność zachowana na stronie.",
    homeState: {
      returning: "Powrót do ostatniego syntetycznego rejestru.",
      new: "Brak wcześniejszych decyzji. Zacznij od materiału testowego poniżej.",
      paused: "Przegląd jest wstrzymany; ślad źródłowy pozostaje nienaruszony.",
      error: "Źródło na żywo jest niedostępne. Widoczny jest tylko stały rejestr testowy.",
    },
    productTitle: "Rejestr do sprawdzenia, nie ostateczny werdykt",
    productLead: "Bezpośrednie obserwacje, wynik pochodny i nierozstrzygnięty kontekst są rozdzielone przed wierszem decyzji.",
    productState: {
      overview: "Przegląd rejestru",
      evidence: "Rejestr dowodów w centrum",
      partial: "Rejestr częściowy: klasyfikacja przetworzenia pozostaje niepotwierdzona",
    },
    scannerTitle: "Zarejestruj kod przed wnioskiem",
    scannerLead: "Deterministyczna koncepcja skanera dla jednego syntetycznego kodu. Bez aparatu i sieci.",
    motionTitle: "Rejestr powstaje w kolejności czytania",
    motionLead: "Linie i wpisy pojawiają się po kolei; żaden dowód nie zależy od ruchu.",
    register: [
      { code: "OBS", label: "Zaobserwowane", kind: "Bezpośrednie", body: "Transkrypcja opakowania z 14 lipca 2026. Zawiera owies; może zawierać soję." },
      { code: "OBL", label: "Obliczone", kind: "Pochodne", body: "Koncepcyjny wynik decyzji: 72 na 100, wyłącznie z tego zamkniętego materiału." },
      { code: "KON", label: "Kontekst", kind: "Interpretacyjne", body: "Umiarkowana pewność. Jedno opakowanie, bez niezależnej weryfikacji; przetworzenie niepotwierdzone." },
      { code: "DEC", label: "Decyzja", kind: "Działanie", body: "Porównaj dane w rejestrze, a przed decyzją sprawdź aktualne opakowanie." },
    ],
    labels: {
      sourceRegister: "Rejestr źródeł", currentRecord: "Bieżący rejestr", continueReview: "Kontynuuj przegląd",
      observed: "Zaobserwowano", confidence: "Pewność", sourceCount: "Źródła", packageSource: "Opakowanie",
      independentSource: "Niezależne", processing: "Przetworzenie", direct: "Bezpośrednie", derived: "Pochodne",
      unresolved: "Nierozstrzygnięte", recordIndex: "Indeks rejestru", evidenceRegister: "Rejestr dowodów",
      fullFacts: "Pełne dane", packageCheck: "Kontrola opakowania", sourceLedger: "Księga źródeł",
      oneTranscription: "1 transkrypcja", zeroVerifications: "0 weryfikacji", unconfirmed: "Niepotwierdzone",
      scannerConcept: "Koncepcja skanera · bez aparatu", readSequence: "Stały materiał referencyjny", motionStudy: "Studium ruchu · stałe czasy",
      identityKicker: "Kandydat B · geometria wstępna", identityPrimaryLockup: "Podstawowy układ znaku",
      identityTagline: "zaobserwuj / oblicz / osadź w kontekście / zdecyduj", identityCharacter: "Charakter",
      identityTypography: "Propozycja typografii", identityDoNot: "Nie należy", identityStatus: "Status",
      identityPalette: "Paleta Evidence Register",
      identityVariants: "Warianty identyfikacji", primary: "Podstawowy", dark: "Ciemny", monochrome: "Monochromatyczny",
      micro: "Mikro · 16", maskable: "Studium maski", nutrition: "Wartości odżywcze", ingredients: "Składniki",
      allergens: "Alergeny", provenance: "Pochodzenie danych", productEvidenceDetail: "Szczegóły dowodów produktu",
      ingredientsUnavailable: "Transkrypcja bazy owsianej wyłącznie do przeglądu. Pełna weryfikacja składników jest niedostępna.",
      allergenEvidenceUnavailable: "Pozostałe dane o alergenach są niedostępne.",
      record: "REJESTR",
    },
    nutrition: {
      caption: "Wartości odżywcze w 100 ml",
      rows: [["Energia", "193 kJ / 46 kcal"], ["Tłuszcz / nasycone", "1,5 g / 0,2 g"], ["Węglowodany / cukry", "7,4 g / 3,2 g"], ["Błonnik / białko", "0,8 g / 1,0 g"], ["Sól", "0,10 g"]],
    },
    motion: {
      stages: [
        { id: "source", label: "Wpisano źródło", description: "Transkrypcja opakowania otwiera rejestr." },
        { id: "facts", label: "Ułożono fakty", description: "Wartości odżywcze i alergeny zajmują stałe wiersze." },
        { id: "context", label: "Dodano kontekst", description: "Pewność i niewiadome są dołączone do obliczenia." },
        { id: "decision", label: "Zapisano decyzję", description: "Rejestr kończy kontrola opakowania, nie absolutny werdykt." },
      ],
      previous: "Poprzedni wpis", next: "Następny wpis", restart: "Uruchom ponownie",
    },
  },
  de: {
    direction: "Evidence Register",
    navigation: ["Register", "Evidenz", "Lesen"],
    identity: [
      "Ein offenes Register für Entscheidungen, die Zeile für Zeile prüfbar bleiben.",
      "Präzises Register · linierte Evidenz · eindeutige Quellenmarkierung.",
      "IBM Plex Sans + IBM Plex Mono. Hier als Systemschrift angenähert; keine Schrift übernommen.",
      "Dokument nicht schließen, Quellenpunkt nicht entfernen, Rahmen nicht abrunden und Kupfer nicht als Gesundheitsnote verwenden.",
      "Arbeitsname und vorläufiger Vektor. Keine Freigabe von Name oder Marke wird behauptet.",
    ],
    landingEyebrow: "Eine Entscheidung sollte eine Spur hinterlassen",
    landingTitle: "Evidenz lesen. Jeden Schritt prüfen.",
    landingBody: "TryVit registriert Beobachtung, Berechnung und Kontext — und hält sichtbar, was weiterhin Ihr Urteil erfordert.",
    primaryAction: "Prüfregister öffnen",
    secondaryAction: "Methode prüfen",
    homeTitle: "Entscheidungsregister",
    homeLead: "Ein Produkt, eine Quellenspur und jede Unsicherheit auf derselben Seite.",
    homeState: {
      returning: "Zurück beim neuesten synthetischen Register.",
      new: "Noch keine Entscheidungen. Beginnen Sie mit dem Prüfmuster unten.",
      paused: "Diese Prüfung ist angehalten; ihre Quellenspur bleibt erhalten.",
      error: "Die Live-Quelle ist nicht verfügbar. Nur das feste Prüfregister wird gezeigt.",
    },
    productTitle: "Ein prüfbares Register, kein endgültiges Urteil",
    productLead: "Direkte Beobachtungen, abgeleitete Ausgabe und ungelöster Kontext werden vor der Entscheidungszeile getrennt.",
    productState: {
      overview: "Registerübersicht",
      evidence: "Evidenzregister im Fokus",
      partial: "Teilregister: Verarbeitungsklassifikation bleibt unbestätigt",
    },
    scannerTitle: "Code vor der Schlussfolgerung registrieren",
    scannerLead: "Ein deterministisches Scannerkonzept für einen synthetischen Strichcode. Ohne Kamera oder Netzwerk.",
    motionTitle: "Ein Register entsteht in Lesereihenfolge",
    motionLead: "Linien und Einträge erscheinen nacheinander; keine Evidenz hängt von Bewegung ab.",
    register: [
      { code: "BEO", label: "Beobachtet", kind: "Direkt", body: "Verpackungsabschrift vom 14. Juli 2026. Enthält Hafer; kann Soja enthalten." },
      { code: "BER", label: "Berechnet", kind: "Abgeleitet", body: "Konzeptionelles Entscheidungsergebnis: 72 von 100, nur aus diesem geschlossenen Prüfmuster." },
      { code: "KON", label: "Kontext", kind: "Interpretativ", body: "Mittlere Verlässlichkeit. Eine Verpackungsabschrift, keine unabhängige Prüfung; Verarbeitung unbestätigt." },
      { code: "ENT", label: "Entscheidung", kind: "Handlung", body: "Vergleichen Sie das Register und prüfen Sie vor der Entscheidung die aktuelle Verpackung." },
    ],
    labels: {
      sourceRegister: "Quellenregister", currentRecord: "Aktueller Eintrag", continueReview: "Prüfung fortsetzen",
      observed: "Beobachtet", confidence: "Verlässlichkeit", sourceCount: "Quellen", packageSource: "Verpackung",
      independentSource: "Unabhängig", processing: "Verarbeitung", direct: "Direkt", derived: "Abgeleitet",
      unresolved: "Ungelöst", recordIndex: "Registerindex", evidenceRegister: "Evidenzregister",
      fullFacts: "Vollständige Fakten", packageCheck: "Verpackungsprüfung", sourceLedger: "Quellenbuch",
      oneTranscription: "1 Abschrift", zeroVerifications: "0 Prüfungen", unconfirmed: "Unbestätigt",
      scannerConcept: "Scannerkonzept · keine Kamera", readSequence: "Festes Prüfmuster", motionStudy: "Bewegungsstudie · feste Zeiten",
      identityKicker: "Kandidat B · vorläufige Geometrie", identityPrimaryLockup: "Primäre Markenkombination",
      identityTagline: "beobachten / berechnen / einordnen / entscheiden", identityCharacter: "Charakter",
      identityTypography: "Typografie-Vorschlag", identityDoNot: "Nicht verwenden", identityStatus: "Status",
      identityPalette: "Evidence-Register-Farbpalette",
      identityVariants: "Identitätsvarianten", primary: "Primär", dark: "Dunkel", monochrome: "Monochrom",
      micro: "Mikro · 16", maskable: "Maskenstudie", nutrition: "Nährwerte", ingredients: "Zutaten",
      allergens: "Allergene", provenance: "Herkunft", productEvidenceDetail: "Details der Produktevidenz",
      ingredientsUnavailable: "Abschrift der Haferbasis nur zur Prüfung. Eine vollständige Zutatenprüfung ist nicht verfügbar.",
      allergenEvidenceUnavailable: "Weitere Allergenevidenz ist nicht verfügbar.",
      record: "REGISTER",
    },
    nutrition: {
      caption: "Nährwerte je 100 ml",
      rows: [["Energie", "193 kJ / 46 kcal"], ["Fett / gesättigt", "1,5 g / 0,2 g"], ["Kohlenhydrate / Zucker", "7,4 g / 3,2 g"], ["Ballaststoffe / Protein", "0,8 g / 1,0 g"], ["Salz", "0,10 g"]],
    },
    motion: {
      stages: [
        { id: "source", label: "Quelle eingetragen", description: "Die Verpackungsabschrift eröffnet das Register." },
        { id: "facts", label: "Fakten liniiert", description: "Nährwerte und Allergene erhalten feste Zeilen." },
        { id: "context", label: "Kontext vermerkt", description: "Verlässlichkeit und offene Fragen ergänzen die Berechnung." },
        { id: "decision", label: "Entscheidung abgelegt", description: "Das Register endet mit einer Verpackungsprüfung, nicht mit einem absoluten Urteil." },
      ],
      previous: "Vorheriger Eintrag", next: "Nächster Eintrag", restart: "Studie neu starten",
    },
  },
};

function EvidenceRegisterMark({ className = "" }: Readonly<{ className?: string }>) {
  return (
    <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 64 64">
      <path className={styles.markFrame} d="M10 54V8H43L55 20V38" />
      <path className={styles.markFold} d="M43 8V20H55" />
      <path className={styles.markRules} d="M21 25H42M21 35H39M21 45H31" />
      <path className={styles.markSource} d="M42 40a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z" />
    </svg>
  );
}

function RegisterHeader({ messages, route }: Readonly<{ messages: EvidenceRegisterMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  return (
    <header className={styles.header}>
      <a className={styles.brand} href={phase5A2ReviewHref("evidence-register", "landing", route.locale, route.theme, route.motion)}>
        <EvidenceRegisterMark />
        <span>TryVit</span>
      </a>
      <nav aria-label={common.navigationLabel}>
        <a href={phase5A2ReviewHref("evidence-register", "home", route.locale, route.theme, route.motion)}>{messages.navigation[0]}</a>
        <a href={phase5A2ReviewHref("evidence-register", "product", route.locale, route.theme, route.motion)}>{messages.navigation[1]}</a>
        <a href={phase5A2ReviewHref("evidence-register", "scanner", route.locale, route.theme, route.motion)}>{messages.navigation[2]}</a>
      </nav>
      <span className={styles.directionLabel}>{messages.direction} · B</span>
    </header>
  );
}

function RegisterEntries({ compact = false, messages }: Readonly<{ compact?: boolean; messages: EvidenceRegisterMessages }>) {
  return (
    <ol className={compact ? styles.entriesCompact : styles.entries}>
      {messages.register.map((entry, index) => (
        <li key={entry.code}>
          <div className={styles.entryIndex}><span>{String(index + 1).padStart(2, "0")}</span><strong>{entry.code}</strong></div>
          <div className={styles.entryBody}><div><h3>{entry.label}</h3><span>{entry.kind}</span></div><p>{entry.body}</p></div>
        </li>
      ))}
    </ol>
  );
}

function IdentitySurface({ messages }: Readonly<{ messages: EvidenceRegisterMessages }>) {
  return (
    <div className={styles.identityBoard}>
      <header className={styles.identityIntro}>
        <div><span>{messages.labels.identityKicker}</span><h1>Evidence Register</h1></div>
        <p>{messages.identity[0]}</p>
      </header>
      <section className={styles.identityHero} aria-label={messages.labels.identityPrimaryLockup}>
        <EvidenceRegisterMark className={styles.identityMark} />
        <div><strong>TryVit</strong><span>{messages.labels.identityTagline}</span></div>
      </section>
      <section aria-label={messages.labels.identityVariants} className={styles.identityRail}>
        <figure><EvidenceRegisterMark /><figcaption>{messages.labels.primary} · 64</figcaption></figure>
        <figure className={styles.darkSpecimen}><EvidenceRegisterMark /><figcaption>{messages.labels.dark}</figcaption></figure>
        <figure className={styles.monoSpecimen}><EvidenceRegisterMark /><figcaption>{messages.labels.monochrome}</figcaption></figure>
        <figure className={styles.microSpecimen}><EvidenceRegisterMark /><figcaption>{messages.labels.micro}</figcaption></figure>
        <figure className={styles.maskSpecimen}><EvidenceRegisterMark /><figcaption>{messages.labels.maskable}</figcaption></figure>
      </section>
      <section className={styles.identityDetails}>
        <div><span>{messages.labels.identityCharacter}</span><p>{messages.identity[1]}</p></div>
        <div><span>{messages.labels.identityTypography}</span><p>{messages.identity[2]}</p></div>
        <div><span>{messages.labels.identityDoNot}</span><p>{messages.identity[3]}</p></div>
        <div><span>{messages.labels.identityStatus}</span><p>{messages.identity[4]}</p></div>
      </section>
      <div aria-label={messages.labels.identityPalette} className={styles.palette} role="img"><span /><span /><span /><span /><span /></div>
    </div>
  );
}

function LandingSurface({ messages, route }: Readonly<{ messages: EvidenceRegisterMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  return (
    <>
      <RegisterHeader messages={messages} route={route} />
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>{messages.landingEyebrow}</span>
          <h1>{messages.landingTitle}</h1>
          <p>{messages.landingBody}</p>
          <div className={styles.heroActions}><a href="#evidence-register-record">{messages.primaryAction}</a><a href="#evidence-register-method">{messages.secondaryAction}</a></div>
          <small>{common.syntheticDisclosure} · {common.notMedicalAdvice}</small>
        </div>
        <figure className={styles.heroRegister}>
          <div className={styles.heroRegisterTop}><EvidenceRegisterMark /><span>TV / 26–0714</span></div>
          <dl>
            <div><dt>{messages.labels.direct}</dt><dd>{common.observedDate}</dd></div>
            <div><dt>{messages.labels.derived}</dt><dd>72 / 100</dd></div>
            <div><dt>{messages.labels.unresolved}</dt><dd>{common.processingUnknown}</dd></div>
          </dl>
          <figcaption>{common.syntheticDisclosure}</figcaption>
        </figure>
      </section>
      <section className={styles.landingRegister} id="evidence-register-record">
        <header><span>{messages.labels.sourceRegister} · 01—04</span><h2 id="evidence-register-method">{messages.productTitle}</h2></header>
        <RegisterEntries compact messages={messages} />
      </section>
    </>
  );
}

function HomeSurface({ messages, route }: Readonly<{ messages: EvidenceRegisterMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  const state = route.state as keyof EvidenceRegisterMessages["homeState"];
  return (
    <div className={styles.appFrame}>
      <RegisterHeader messages={messages} route={route} />
      <nav aria-label={messages.labels.recordIndex} className={styles.appRail}><strong>R/26</strong><a aria-current="location" href="#current">01</a><a href="#register">02</a><a href="#ledger">03</a></nav>
      <section className={styles.homeWorkspace}>
        <header><span>{common.syntheticDisclosure}</span><h1>{messages.homeTitle}</h1><p>{messages.homeLead}</p><small>{messages.homeState[state]}</small></header>
        <div className={styles.homeSearch}>
          <ProductLookup
            className={styles.productLookup}
            copy={common.productLookup}
            ean={PHASE5A2_FIXTURE.ean}
            fixtureName={common.fixtureName}
          />
        </div>
        <a className={styles.currentRecord} href={phase5A2ReviewHref("evidence-register", "product", route.locale, route.theme, route.motion)} id="current">
          <div className={styles.recordStamp}><span>R</span><strong>01</strong></div>
          <div><span>{messages.labels.continueReview}</span><strong>{common.fixtureName}</strong><small>{common.conceptScore}</small></div>
          <dl><div><dt>{messages.labels.observed}</dt><dd>14·07·2026</dd></div><div><dt>{messages.labels.confidence}</dt><dd>{common.confidence}</dd></div><div><dt>{messages.labels.sourceCount}</dt><dd>1 / 0</dd></div></dl>
        </a>
        <section className={styles.homeRegister} id="register"><h2>{messages.labels.currentRecord}</h2><RegisterEntries compact messages={messages} /></section>
        <aside className={styles.sourceNote} id="ledger"><span>{messages.labels.sourceLedger}</span><p>{common.confidenceExplanation} {common.processingUnknown}</p></aside>
      </section>
    </div>
  );
}

function NutritionTable({ messages }: Readonly<{ messages: EvidenceRegisterMessages }>) {
  return (
    <table className={styles.nutritionTable}>
      <caption>{messages.nutrition.caption}</caption>
      <tbody>{messages.nutrition.rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody>
    </table>
  );
}

function ProductSurface({ messages, route }: Readonly<{ messages: EvidenceRegisterMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  const state = route.state as keyof EvidenceRegisterMessages["productState"];
  const defaultTab = route.state === "evidence" ? "provenance" : "nutrition";
  return (
    <>
      <RegisterHeader messages={messages} route={route} />
      <article className={styles.product}>
        <header className={styles.productMasthead}>
          <div className={styles.recordNumber}><span>{messages.labels.record}</span><strong>26—0714 / 01</strong><small>{messages.productState[state]}</small></div>
          <div className={styles.productIdentity}><span>{common.observedDate}</span><h1>{common.fixtureName}</h1><p>{messages.productLead}</p><div className={styles.allergens}><strong>{common.containsOats}</strong><span>{common.mayContainSoy}</span></div></div>
          <div className={styles.scoreRegister}><span>{messages.labels.derived}</span><strong>72<small>/100</small></strong><p>{common.confidence}</p><small>{common.notMedicalAdvice}</small></div>
        </header>
        <div className={styles.productGrid}>
          <nav aria-label={messages.labels.recordIndex} className={styles.productIndex}><span>{messages.labels.recordIndex}</span><a href="#product-register">01 · {messages.labels.evidenceRegister}</a><a href="#product-facts">02 · {messages.labels.fullFacts}</a><a href="#product-package">03 · {messages.labels.packageCheck}</a></nav>
          <section className={styles.dossier} id="product-register"><h2>{messages.productTitle}</h2><RegisterEntries messages={messages} /></section>
          <aside className={styles.ledger}><span>{messages.labels.sourceLedger}</span><dl><div><dt>{messages.labels.packageSource}</dt><dd>{messages.labels.oneTranscription}</dd></div><div><dt>{messages.labels.independentSource}</dt><dd>{messages.labels.zeroVerifications}</dd></div><div><dt>{messages.labels.processing}</dt><dd>{messages.labels.unconfirmed}</dd></div></dl></aside>
        </div>
        <Surface as="div" boundary="strong" className={styles.productDetail} density="spacious" id="product-facts">
          <Tabs activationMode="manual" defaultValue={defaultTab} label={messages.labels.productEvidenceDetail} items={[
            { value: "nutrition", label: messages.labels.nutrition, panel: <NutritionTable messages={messages} /> },
            { value: "ingredients", label: messages.labels.ingredients, panel: <p>{messages.labels.ingredientsUnavailable}</p> },
            { value: "allergens", label: messages.labels.allergens, panel: <p>{common.containsOats}. {common.mayContainSoy}. {messages.labels.allergenEvidenceUnavailable}</p> },
            { value: "provenance", label: messages.labels.provenance, panel: <p>{common.observedDate}. {common.confidenceExplanation}</p> },
          ]} />
        </Surface>
        <p className={styles.packageReminder} id="product-package">{common.packageReminder}</p>
      </article>
    </>
  );
}

function ScannerSurface({ messages, route }: Readonly<{ messages: EvidenceRegisterMessages; route: Phase5A2RouteState }>) {
  const common = PHASE5A2_COMMON_MESSAGES[route.locale];
  return (
    <>
      <RegisterHeader messages={messages} route={route} />
      <section className={styles.scannerPage}>
        <header><span>{messages.labels.scannerConcept}</span><h1>{messages.scannerTitle}</h1><p>{messages.scannerLead}</p></header>
        <ScannerStudy className={styles.scannerControls} copy={common.scanner} direction="evidence-register" ean={PHASE5A2_FIXTURE.ean} initialState={route.state as Parameters<typeof ScannerStudy>[0]["initialState"]} />
        <div className={styles.scannerGrid}>
          <div aria-hidden="true" className={styles.scanViewport}><div className={styles.scanRules}><i /><i /><i /><i /></div><EvidenceRegisterMark /><span>{PHASE5A2_FIXTURE.ean}</span></div>
          <div className={styles.scannerResult} data-phase5a2-fixture-reference=""><span>{messages.labels.readSequence}</span><ol><li><span>01</span>{common.observedDate}</li><li><span>02</span>{common.confidence}</li><li><span>03</span>{common.processingUnknown}</li></ol><strong>{common.conceptScore}</strong></div>
        </div>
      </section>
    </>
  );
}

function MotionSurface({ messages, route }: Readonly<{ messages: EvidenceRegisterMessages; route: Phase5A2RouteState }>) {
  const initialStage = route.state === "start" ? 0 : route.state === "mid" ? 1 : 3;
  return (
    <>
      <RegisterHeader messages={messages} route={route} />
      <section className={styles.motionPage}>
        <header><span>{messages.labels.motionStudy} · 0/120/180/240/360/500ms</span><h1>{messages.motionTitle}</h1><p>{messages.motionLead}</p></header>
        <div aria-hidden="true" className={styles.motionRegister}><EvidenceRegisterMark /><i /><i /><i /></div>
        <MotionStudy className={styles.motionControls} copy={messages.motion} direction="evidence-register" initialStage={initialStage} motionMode={route.motion} />
      </section>
    </>
  );
}

export function EvidenceRegister({ route }: Readonly<{ route: Phase5A2RouteState }>) {
  const messages = EVIDENCE_REGISTER_MESSAGES[route.locale];
  return (
    <main
      className={styles.root}
      data-design-system="v2"
      data-phase5a2-candidate="evidence-register"
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
