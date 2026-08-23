import type { GoldenLocale, GoldenReference } from "./contract";

export interface GoldenCommonCopy {
  readonly reviewOnly: string;
  readonly synthetic: string;
  readonly decision: string;
  readonly score: string;
  readonly scoreDerived: string;
  readonly dataConfidence: string;
  readonly confidenceValue: string;
  readonly confidenceReason: string;
  readonly mainReason: string;
  readonly nextAction: string;
  readonly observed: string;
  readonly derived: string;
  readonly contextual: string;
  readonly decisionLayer: string;
  readonly unknown: string;
  readonly unknownInvariant: string;
  readonly packageReminder: string;
  readonly retry: string;
  readonly close: string;
  readonly states: string;
  readonly referenceNames: Readonly<Record<GoldenReference, string>>;
}

export const GOLDEN_COMMON_COPY: Readonly<Record<GoldenLocale, GoldenCommonCopy>> = {
  en: {
    reviewOnly: "Non-production review",
    synthetic: "Synthetic fixture",
    decision: "Decision",
    score: "Concept score",
    scoreDerived: "Derived by TryVit review method v0.9",
    dataConfidence: "Data confidence",
    confidenceValue: "Moderate",
    confidenceReason: "One package transcription; zero independent checks.",
    mainReason: "Main reason",
    nextAction: "Next action",
    observed: "Observed",
    derived: "Derived",
    contextual: "Context",
    decisionLayer: "Decision",
    unknown: "Not assessed",
    unknownInvariant: "Not assessed—missing evidence does not mean absent.",
    packageReminder: "Always check the current package. Ingredients and formulations can change.",
    retry: "Try again",
    close: "Close",
    states: "Reference states",
    referenceNames: {
      landing: "Landing",
      authentication: "Authentication",
      home: "Home",
      search: "Search",
      product: "Product evidence",
      scanner: "Scanner",
    },
  },
  pl: {
    reviewOnly: "Widok nieprodukcyjny",
    synthetic: "Materiał syntetyczny",
    decision: "Decyzja",
    score: "Wynik koncepcyjny",
    scoreDerived: "Wyliczony metodą przeglądową TryVit v0.9",
    dataConfidence: "Wiarygodność danych",
    confidenceValue: "Umiarkowana",
    confidenceReason: "Jeden zapis z opakowania; bez niezależnej weryfikacji.",
    mainReason: "Główny powód",
    nextAction: "Następny krok",
    observed: "Dane z opakowania",
    derived: "Wyliczone",
    contextual: "Kontekst",
    decisionLayer: "Decyzja",
    unknown: "Nie oceniono",
    unknownInvariant: "Nie oceniono—brak danych nie oznacza braku.",
    packageReminder: "Zawsze sprawdź aktualne opakowanie. Skład i receptura mogą się zmienić.",
    retry: "Spróbuj ponownie",
    close: "Zamknij",
    states: "Stany widoku",
    referenceNames: {
      landing: "Strona główna",
      authentication: "Logowanie",
      home: "Panel główny",
      search: "Wyszukiwanie",
      product: "Produkt i dane",
      scanner: "Skaner",
    },
  },
  de: {
    reviewOnly: "Nicht produktive Prüfung",
    synthetic: "Synthetischer Datensatz",
    decision: "Entscheidung",
    score: "Konzeptioneller Wert",
    scoreDerived: "Abgeleitet mit TryVit-Prüfmethode v0.9",
    dataConfidence: "Datenverlässlichkeit",
    confidenceValue: "Mittel",
    confidenceReason: "Eine Verpackungsabschrift; keine unabhängige Prüfung.",
    mainReason: "Hauptgrund",
    nextAction: "Nächster Schritt",
    observed: "Verpackungsangaben",
    derived: "Abgeleitet",
    contextual: "Kontext",
    decisionLayer: "Entscheidung",
    unknown: "Nicht bewertet",
    unknownInvariant: "Nicht bewertet—fehlende Angaben bedeuten keine Abwesenheit.",
    packageReminder: "Prüfen Sie immer die aktuelle Verpackung. Zutaten und Rezepturen können sich ändern.",
    retry: "Erneut versuchen",
    close: "Schließen",
    states: "Referenzzustände",
    referenceNames: {
      landing: "Startseite",
      authentication: "Anmeldung",
      home: "Übersicht",
      search: "Suche",
      product: "Produkt und Evidenz",
      scanner: "Scanner",
    },
  },
};
