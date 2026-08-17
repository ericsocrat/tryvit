import type { Phase5A2Locale } from "./contract";
import type { ScannerStudyCopy } from "./ScannerStudy.client";
import type { ProductLookupCopy } from "./ProductLookup.client";

export interface Phase5A2CommonMessages {
  readonly syntheticDisclosure: string;
  readonly fixtureName: string;
  readonly observedDate: string;
  readonly conceptScore: string;
  readonly confidence: string;
  readonly confidenceExplanation: string;
  readonly processingUnknown: string;
  readonly containsOats: string;
  readonly mayContainSoy: string;
  readonly packageReminder: string;
  readonly notMedicalAdvice: string;
  readonly navigationLabel: string;
  readonly productLookup: ProductLookupCopy;
  readonly scanner: ScannerStudyCopy;
}

export const PHASE5A2_COMMON_MESSAGES: Readonly<Record<Phase5A2Locale, Phase5A2CommonMessages>> = {
  en: {
    syntheticDisclosure: "Synthetic review fixture",
    fixtureName: "North Grain Oat Drink — review fixture",
    observedDate: "Observed 14 July 2026",
    conceptScore: "Concept decision score: 72 out of 100",
    confidence: "Moderate confidence",
    confidenceExplanation: "One package transcription; no independent verification.",
    processingUnknown: "Processing classification unconfirmed.",
    containsOats: "Contains oats",
    mayContainSoy: "May contain soy",
    packageReminder: "Always check the current package. Ingredients and formulations can change.",
    notMedicalAdvice: "Review concept only. Not medical advice.",
    navigationLabel: "Candidate navigation",
    productLookup: {
      label: "Find a product or EAN",
      hint: "One deterministic synthetic fixture is available.",
      placeholder: "Product name or barcode",
      empty: "No fixture matches this query.",
      loading: "Loading review fixtures.",
      results: "{count} review fixture available.",
    },
    scanner: {
      stateLabel: {
        permission: "Camera permission has not been requested. No camera is active.",
        ready: "Concept preview ready. No camera is active.",
        recognized: "Barcode recognized from the synthetic fixture.",
        processing: "Building the review sequence, step 3 of 4.",
        matched: "Synthetic fixture matched. Moderate confidence.",
        partial: "Partial match. Processing classification remains unconfirmed.",
        "not-found": "No fixture match was found.",
        offline: "Offline concept. The manual fixture remains available.",
        "camera-unavailable": "Camera unavailable. No access was attempted.",
        manual: "Enter the fixed review barcode.",
      },
      begin: "Begin concept sequence",
      buildResult: "Build evidence result",
      cancel: "Cancel sequence",
      retry: "Try sequence again",
      useManual: "Use manual entry",
      manualLabel: "EAN-13 barcode",
      manualHint: "Use the synthetic fixture: 5901234123457",
      manualSubmit: "Match review fixture",
      manualInvalid: "Enter the 13-digit synthetic fixture barcode.",
    },
  },
  pl: {
    syntheticDisclosure: "Syntetyczny materiał do przeglądu",
    fixtureName: "North Grain Oat Drink — materiał testowy",
    observedDate: "Zaobserwowano 14 lipca 2026",
    conceptScore: "Koncepcyjny wynik decyzji: 72 na 100",
    confidence: "Umiarkowana pewność",
    confidenceExplanation: "Dane przepisano z jednego opakowania; bez niezależnej weryfikacji.",
    processingUnknown: "Klasyfikacja przetworzenia niepotwierdzona.",
    containsOats: "Zawiera owies",
    mayContainSoy: "Może zawierać soję",
    packageReminder: "Zawsze sprawdź aktualne opakowanie. Skład i receptura mogą się zmienić.",
    notMedicalAdvice: "Wyłącznie koncepcja do przeglądu. To nie jest porada medyczna.",
    navigationLabel: "Nawigacja kandydata",
    productLookup: {
      label: "Znajdź produkt lub kod EAN",
      hint: "Dostępny jest jeden deterministyczny materiał syntetyczny.",
      placeholder: "Nazwa produktu lub kod",
      empty: "Brak pasującego materiału testowego.",
      loading: "Wczytywanie materiałów testowych.",
      results: "Dostępne materiały testowe: {count}.",
    },
    scanner: {
      stateLabel: {
        permission: "Nie poproszono o dostęp do aparatu. Aparat nie jest aktywny.",
        ready: "Podgląd koncepcji jest gotowy. Aparat nie jest aktywny.",
        recognized: "Rozpoznano kod z syntetycznego materiału testowego.",
        processing: "Tworzenie sekwencji przeglądu — krok 3 z 4.",
        matched: "Dopasowano materiał testowy. Umiarkowana pewność.",
        partial: "Częściowe dopasowanie. Klasyfikacja przetworzenia pozostaje niepotwierdzona.",
        "not-found": "Nie znaleziono dopasowania w materiale testowym.",
        offline: "Koncepcja offline. Ręczny materiał testowy jest nadal dostępny.",
        "camera-unavailable": "Aparat niedostępny. Nie próbowano uzyskać dostępu.",
        manual: "Wpisz stały kod testowy.",
      },
      begin: "Uruchom sekwencję koncepcyjną",
      buildResult: "Zbuduj wynik dowodowy",
      cancel: "Anuluj sekwencję",
      retry: "Uruchom sekwencję ponownie",
      useManual: "Wpisz kod ręcznie",
      manualLabel: "Kod kreskowy EAN-13",
      manualHint: "Użyj materiału testowego: 5901234123457",
      manualSubmit: "Dopasuj materiał testowy",
      manualInvalid: "Wpisz 13-cyfrowy kod syntetycznego materiału testowego.",
    },
  },
  de: {
    syntheticDisclosure: "Synthetischer Prüfdatensatz",
    fixtureName: "North Grain Oat Drink — Prüfmuster",
    observedDate: "Beobachtet am 14. Juli 2026",
    conceptScore: "Konzeptionelles Entscheidungsergebnis: 72 von 100",
    confidence: "Mittlere Verlässlichkeit",
    confidenceExplanation: "Angaben von einer Verpackung abgeschrieben; ohne unabhängige Überprüfung.",
    processingUnknown: "Die Verarbeitungsklassifikation ist nicht bestätigt.",
    containsOats: "Enthält Hafer",
    mayContainSoy: "Kann Soja enthalten",
    packageReminder: "Prüfen Sie immer die aktuelle Verpackung. Zutaten und Rezepturen können sich ändern.",
    notMedicalAdvice: "Nur ein Prüfungskonzept. Keine medizinische Beratung.",
    navigationLabel: "Kandidatennavigation",
    productLookup: {
      label: "Produkt oder EAN suchen",
      hint: "Ein deterministisches synthetisches Prüfmuster ist verfügbar.",
      placeholder: "Produktname oder Strichcode",
      empty: "Kein Prüfmuster entspricht dieser Suche.",
      loading: "Prüfmuster werden geladen.",
      results: "{count} Prüfmuster verfügbar.",
    },
    scanner: {
      stateLabel: {
        permission: "Eine Kameraberechtigung wurde nicht angefordert. Keine Kamera ist aktiv.",
        ready: "Die Konzeptvorschau ist bereit. Keine Kamera ist aktiv.",
        recognized: "Der Strichcode des synthetischen Prüfmusters wurde erkannt.",
        processing: "Die Prüfsequenz wird aufgebaut — Schritt 3 von 4.",
        matched: "Synthetisches Prüfmuster gefunden. Mittlere Verlässlichkeit.",
        partial: "Teilweise Übereinstimmung. Die Verarbeitungsklassifikation bleibt unbestätigt.",
        "not-found": "Im Prüfmuster wurde keine Übereinstimmung gefunden.",
        offline: "Offline-Konzept. Die manuelle Eingabe des Prüfmusters bleibt verfügbar.",
        "camera-unavailable": "Kamera nicht verfügbar. Es wurde kein Zugriff versucht.",
        manual: "Geben Sie den festgelegten Prüfstrichcode ein.",
      },
      begin: "Konzeptsequenz beginnen",
      buildResult: "Evidenzergebnis aufbauen",
      cancel: "Sequenz abbrechen",
      retry: "Sequenz erneut starten",
      useManual: "Manuelle Eingabe verwenden",
      manualLabel: "EAN-13-Strichcode",
      manualHint: "Synthetisches Prüfmuster verwenden: 5901234123457",
      manualSubmit: "Prüfmuster abgleichen",
      manualInvalid: "Geben Sie den 13-stelligen Strichcode des synthetischen Prüfmusters ein.",
    },
  },
};
