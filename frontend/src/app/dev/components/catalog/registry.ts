import type { SupportedLanguage } from "@/stores/language-store";

export const catalogSceneIds = [
  "foundations",
  "actions-forms",
  "overlays-navigation",
  "evidence-page-states",
] as const;

export type CatalogSceneId = (typeof catalogSceneIds)[number];

interface FoundationCopy {
  readonly cards: string;
  readonly cardDefault: string;
  readonly cardDefaultDescription: string;
  readonly cardRaised: string;
  readonly cardRaisedDescription: string;
  readonly cardOutlined: string;
  readonly cardOutlinedDescription: string;
  readonly feedback: string;
  readonly chips: string;
  readonly progress: string;
  readonly livingLabel: string;
  readonly foundationDescription: string;
  readonly swatchesLabel: string;
  readonly canvas: string;
  readonly surface: string;
  readonly action: string;
  readonly evidence: string;
}

interface ActionsCopy {
  readonly buttons: string;
  readonly primary: string;
  readonly secondary: string;
  readonly quiet: string;
  readonly destructive: string;
  readonly small: string;
  readonly medium: string;
  readonly large: string;
  readonly loading: string;
  readonly disabled: string;
  readonly fullWidth: string;
  readonly defaultField: string;
  readonly defaultPlaceholder: string;
  readonly invalidField: string;
  readonly invalidValue: string;
  readonly requiredError: string;
  readonly hintField: string;
  readonly hint: string;
  readonly searchField: string;
  readonly searchPlaceholder: string;
  readonly disabledField: string;
  readonly disabledValue: string;
  readonly category: string;
  readonly chooseCategory: string;
  readonly categoryOptions: readonly [string, string, string];
  readonly notes: string;
  readonly notesHint: string;
  readonly notesValue: string;
  readonly controls: string;
  readonly switchOff: string;
  readonly switchOn: string;
  readonly checkboxDefault: string;
  readonly checkboxChecked: string;
  readonly checkboxMixed: string;
}

interface InteractionCopy {
  readonly iconButtons: string;
  readonly edit: string;
  readonly remove: string;
  readonly settings: string;
  readonly copy: string;
  readonly tooltipCues: string;
  readonly tooltipTop: string;
  readonly tooltipRight: string;
  readonly tooltipBottom: string;
  readonly tooltipLeft: string;
  readonly alerts: string;
  readonly alertInfoTitle: string;
  readonly alertInfoBody: string;
  readonly alertSuccessTitle: string;
  readonly alertSuccessBody: string;
  readonly alertWarningTitle: string;
  readonly alertWarningBody: string;
  readonly alertErrorTitle: string;
  readonly alertErrorBody: string;
}

interface EvidenceCopy {
  readonly scoreBands: string;
  readonly scoreLabels: readonly [string, string, string, string, string, string];
  readonly nutriScore: string;
  readonly novaGroups: string;
  readonly novaLabels: readonly [string, string, string, string, string];
  readonly confidence: string;
  readonly confidenceLabels: readonly [string, string, string, string];
  readonly nutrition: string;
  readonly nutrientLabels: readonly [string, string, string, string];
  readonly nutritionLevels: readonly [string, string, string];
  readonly allergenStatus: string;
  readonly allergenLabels: readonly [string, string, string, string, string];
  readonly allergenNames: readonly [string, string, string, string, string];
  readonly fixtureDescription: string;
  readonly sourceChecked: string;
  readonly source: string;
  readonly sourceValue: string;
  readonly observed: string;
  readonly status: string;
  readonly statusValue: string;
}

export interface CatalogCopy {
  readonly title: string;
  readonly description: string;
  readonly sceneNavigationLabel: string;
  readonly scenes: Readonly<Record<CatalogSceneId, string>>;
  readonly specimenLabel: string;
  readonly specimenNote: string;
  readonly feedbackLabels: readonly [string, string, string, string, string];
  readonly chipLabels: readonly [string, string, string, string, string, string, string];
  readonly foundation: FoundationCopy;
  readonly actions: ActionsCopy;
  readonly interaction: InteractionCopy;
  readonly evidence: EvidenceCopy;
  readonly fixtureNote: string;
}

const catalogCopy: Readonly<Record<SupportedLanguage, CatalogCopy>> = {
  en: {
    title: "Design-system foundation catalog",
    description:
      "Deterministic, data-independent specimens for reviewing V2 semantics before canonical components ship.",
    sceneNavigationLabel: "Catalog scenes",
    scenes: {
      foundations: "Foundations and semantic roles",
      "actions-forms": "Action and form specimens",
      "overlays-navigation": "Interaction cues and feedback",
      "evidence-page-states": "Evidence semantics and status states",
    },
    specimenLabel: "V2 foundation specimen",
    specimenNote: "Canonical component and compatibility facades ship in Phase 5A.1b.",
    feedbackLabels: ["Information", "Success", "Warning", "Error", "Neutral"],
    chipLabels: ["Neutral", "Action", "Success", "Warning", "Error", "Information", "Subtle"],
    foundation: {
      cards: "Surface variants",
      cardDefault: "Default",
      cardDefaultDescription: "Standard surface with a meaningful boundary.",
      cardRaised: "Raised",
      cardRaisedDescription: "Low elevation for content that must sit above its surroundings.",
      cardOutlined: "Outlined",
      cardOutlinedDescription: "Stronger boundary without decorative elevation.",
      feedback: "Feedback labels",
      chips: "Compact labels",
      progress: "Progress states",
      livingLabel: "Living Label V2 hypothesis",
      foundationDescription: "Ingredient transparency fixture · fixed source · reviewable context",
      swatchesLabel: "Living Label semantic color roles",
      canvas: "Canvas",
      surface: "Surface",
      action: "Action",
      evidence: "Evidence",
    },
    actions: {
      buttons: "Button states",
      primary: "Primary",
      secondary: "Secondary",
      quiet: "Quiet",
      destructive: "Delete",
      small: "Small",
      medium: "Medium",
      large: "Large",
      loading: "Saving…",
      disabled: "Unavailable",
      fullWidth: "Continue across the full available width",
      defaultField: "Product name",
      defaultPlaceholder: "Enter a product name…",
      invalidField: "Required source",
      invalidValue: "Unverified source",
      requiredError: "Add a source that another person can verify.",
      hintField: "Source note",
      hint: "Use no more than 100 characters.",
      searchField: "Search",
      searchPlaceholder: "Search ingredients and products…",
      disabledField: "Locked record",
      disabledValue: "This reviewed value cannot be edited.",
      category: "Category",
      chooseCategory: "Choose a category…",
      categoryOptions: ["Snacks", "Drinks", "Breakfast foods"],
      notes: "Review notes",
      notesHint: "Optional context for the next reviewer.",
      notesValue: "The package label and source date remain visible beside this note.",
      controls: "Selection controls",
      switchOff: "Automatic updates off",
      switchOn: "Automatic updates on",
      checkboxDefault: "Include source context",
      checkboxChecked: "Show confidence",
      checkboxMixed: "Some evidence selected",
    },
    interaction: {
      iconButtons: "Icon-action appearances",
      edit: "Edit",
      remove: "Delete",
      settings: "Settings",
      copy: "Copy evidence link",
      tooltipCues: "Placement diagrams",
      tooltipTop: "Appears above",
      tooltipRight: "Appears to the right",
      tooltipBottom: "Appears below",
      tooltipLeft: "Appears to the left",
      alerts: "Feedback messages",
      alertInfoTitle: "Information",
      alertInfoBody: "The source is available and can be reviewed.",
      alertSuccessTitle: "Saved",
      alertSuccessBody: "The evidence record was updated successfully.",
      alertWarningTitle: "Review needed",
      alertWarningBody: "Confidence is limited; inspect the source before deciding.",
      alertErrorTitle: "Could not save",
      alertErrorBody: "Your changes are still present. Try again when the connection returns.",
    },
    evidence: {
      scoreBands: "Score bands (1–100)",
      scoreLabels: ["Excellent", "High", "Moderate", "Low", "Very low", "Unavailable"],
      nutriScore: "Nutri-Score grades",
      novaGroups: "NOVA groups",
      novaLabels: ["Unprocessed", "Processed ingredients", "Processed", "Ultra-processed", "Unknown"],
      confidence: "Confidence",
      confidenceLabels: ["Verified 95%", "Estimated 65%", "Limited 30%", "Unknown"],
      nutrition: "Per 100 g",
      nutrientLabels: ["Fat 2.5 g", "Saturates 8 g", "Sugars 15 g", "Salt 0.3 g"],
      nutritionLevels: ["Low", "Medium", "High"],
      allergenStatus: "Allergen evidence",
      allergenLabels: ["Contains", "May contain", "Derived", "Unknown", "Assessed absent"],
      allergenNames: ["Gluten", "Milk", "Egg", "Soy", "Nuts"],
      fixtureDescription: "A fixed source, confidence and explanation make this state reviewable.",
      sourceChecked: "Source checked",
      source: "Source",
      sourceValue: "Ingredient panel",
      observed: "Observed",
      status: "Status",
      statusValue: "Reviewable",
    },
    fixtureNote: "Candidate evidence only — this catalog is not an approved production baseline.",
  },
  pl: {
    title: "Katalog podstaw systemu projektowego",
    description:
      "Deterministyczne, niezależne od danych przykłady V2 przygotowane do oceny semantyki przed wdrożeniem komponentów docelowych.",
    sceneNavigationLabel: "Sceny katalogu",
    scenes: {
      foundations: "Podstawy i role semantyczne",
      "actions-forms": "Przykłady akcji i formularzy",
      "overlays-navigation": "Wskazówki interakcji i komunikaty",
      "evidence-page-states": "Semantyka dowodów i stany informacji",
    },
    specimenLabel: "Przykład podstaw V2",
    specimenNote: "Komponenty docelowe i fasady zgodności powstaną w fazie 5A.1b.",
    feedbackLabels: ["Informacja", "Sukces", "Ostrzeżenie", "Błąd", "Neutralny"],
    chipLabels: ["Neutralny", "Akcja", "Sukces", "Ostrzeżenie", "Błąd", "Informacja", "Subtelny"],
    foundation: {
      cards: "Warianty powierzchni",
      cardDefault: "Domyślna",
      cardDefaultDescription: "Standardowa powierzchnia z czytelną granicą.",
      cardRaised: "Uniesiona",
      cardRaisedDescription: "Niewielkie uniesienie dla treści, która wymaga wyraźnego oddzielenia.",
      cardOutlined: "Obramowana",
      cardOutlinedDescription: "Mocniejsza granica bez dekoracyjnego cienia.",
      feedback: "Etykiety komunikatów",
      chips: "Etykiety kompaktowe",
      progress: "Stany postępu",
      livingLabel: "Hipoteza Żywej etykiety V2",
      foundationDescription: "Przejrzystość składników · stałe źródło · kontekst możliwy do sprawdzenia",
      swatchesLabel: "Semantyczne role kolorów Żywej etykiety",
      canvas: "Tło",
      surface: "Powierzchnia",
      action: "Akcja",
      evidence: "Dowód",
    },
    actions: {
      buttons: "Stany przycisków",
      primary: "Główny",
      secondary: "Drugorzędny",
      quiet: "Dyskretny",
      destructive: "Usuń",
      small: "Mały",
      medium: "Średni",
      large: "Duży",
      loading: "Zapisywanie…",
      disabled: "Niedostępny",
      fullWidth: "Przejdź dalej, wykorzystując całą dostępną szerokość",
      defaultField: "Nazwa produktu",
      defaultPlaceholder: "Wpisz nazwę produktu…",
      invalidField: "Wymagane źródło",
      invalidValue: "Źródło bez potwierdzenia",
      requiredError: "Dodaj źródło, które inna osoba może sprawdzić.",
      hintField: "Notatka o źródle",
      hint: "Użyj najwyżej 100 znaków.",
      searchField: "Wyszukiwanie",
      searchPlaceholder: "Szukaj składników i produktów…",
      disabledField: "Zablokowany zapis",
      disabledValue: "Tej zweryfikowanej wartości nie można edytować.",
      category: "Kategoria",
      chooseCategory: "Wybierz kategorię…",
      categoryOptions: ["Przekąski", "Napoje", "Produkty śniadaniowe"],
      notes: "Uwagi do weryfikacji",
      notesHint: "Opcjonalny kontekst dla kolejnej osoby sprawdzającej.",
      notesValue: "Etykieta opakowania i data źródła pozostają widoczne obok tej notatki.",
      controls: "Elementy wyboru",
      switchOff: "Automatyczne aktualizacje wyłączone",
      switchOn: "Automatyczne aktualizacje włączone",
      checkboxDefault: "Uwzględnij kontekst źródła",
      checkboxChecked: "Pokaż poziom pewności",
      checkboxMixed: "Wybrano część dowodów",
    },
    interaction: {
      iconButtons: "Wygląd akcji z ikonami",
      edit: "Edytuj",
      remove: "Usuń",
      settings: "Ustawienia",
      copy: "Kopiuj odsyłacz do dowodu",
      tooltipCues: "Schematy rozmieszczenia",
      tooltipTop: "Pojawia się nad elementem",
      tooltipRight: "Pojawia się po prawej stronie",
      tooltipBottom: "Pojawia się pod elementem",
      tooltipLeft: "Pojawia się po lewej stronie",
      alerts: "Komunikaty zwrotne",
      alertInfoTitle: "Informacja",
      alertInfoBody: "Źródło jest dostępne i można je sprawdzić.",
      alertSuccessTitle: "Zapisano",
      alertSuccessBody: "Zapis dowodu został pomyślnie zaktualizowany.",
      alertWarningTitle: "Wymagana weryfikacja",
      alertWarningBody: "Poziom pewności jest ograniczony; przed decyzją sprawdź źródło.",
      alertErrorTitle: "Nie udało się zapisać",
      alertErrorBody: "Zmiany nie zniknęły. Spróbuj ponownie po odzyskaniu połączenia.",
    },
    evidence: {
      scoreBands: "Przedziały wyniku (1–100)",
      scoreLabels: ["Doskonały", "Wysoki", "Umiarkowany", "Niski", "Bardzo niski", "Brak danych"],
      nutriScore: "Oceny Nutri-Score",
      novaGroups: "Grupy NOVA",
      novaLabels: ["Nieprzetworzone", "Przetworzone składniki", "Przetworzone", "Wysoko przetworzone", "Nieznane"],
      confidence: "Pewność danych",
      confidenceLabels: ["Zweryfikowane 95%", "Oszacowane 65%", "Ograniczone 30%", "Nieznane"],
      nutrition: "W przeliczeniu na 100 g",
      nutrientLabels: ["Tłuszcz 2,5 g", "Kwasy nasycone 8 g", "Cukry 15 g", "Sól 0,3 g"],
      nutritionLevels: ["Niski", "Średni", "Wysoki"],
      allergenStatus: "Dowody dotyczące alergenów",
      allergenLabels: ["Zawiera", "Może zawierać", "Pochodna", "Nieznane", "Potwierdzono brak"],
      allergenNames: ["Gluten", "Mleko", "Jaja", "Soja", "Orzechy"],
      fixtureDescription: "Stałe źródło, poziom pewności i wyjaśnienie umożliwiają ocenę tego stanu.",
      sourceChecked: "Źródło sprawdzone",
      source: "Źródło",
      sourceValue: "Wykaz składników",
      observed: "Data obserwacji",
      status: "Stan",
      statusValue: "Możliwy do sprawdzenia",
    },
    fixtureNote: "Wyłącznie materiał roboczy — ten katalog nie jest zatwierdzoną bazą produkcyjną.",
  },
  de: {
    title: "Katalog der Designsystem-Grundlagen",
    description:
      "Deterministische, datenunabhängige V2-Beispiele zur sorgfältigen Prüfung der Semantik, bevor die verbindlichen Komponenten ausgeliefert werden.",
    sceneNavigationLabel: "Katalogszenen",
    scenes: {
      foundations: "Grundlagen und semantische Rollen",
      "actions-forms": "Aktions- und Formularbeispiele",
      "overlays-navigation": "Interaktionshinweise und Rückmeldungen",
      "evidence-page-states": "Evidenzsemantik und Informationszustände",
    },
    specimenLabel: "V2-Grundlagenbeispiel",
    specimenNote: "Verbindliche Komponenten und Kompatibilitätsfassaden folgen in Phase 5A.1b.",
    feedbackLabels: ["Information", "Erfolg", "Warnung", "Fehler", "Neutral"],
    chipLabels: ["Neutral", "Aktion", "Erfolg", "Warnung", "Fehler", "Information", "Dezent"],
    foundation: {
      cards: "Oberflächenvarianten",
      cardDefault: "Standard",
      cardDefaultDescription: "Standardoberfläche mit einer bedeutungstragenden Begrenzung.",
      cardRaised: "Angehoben",
      cardRaisedDescription: "Geringe Anhebung für Inhalte, die sich klar von ihrer Umgebung abheben müssen.",
      cardOutlined: "Umrandet",
      cardOutlinedDescription: "Stärkere Begrenzung ohne rein dekorative Anhebung.",
      feedback: "Rückmeldungskennzeichnungen",
      chips: "Kompakte Kennzeichnungen",
      progress: "Fortschrittszustände",
      livingLabel: "Living-Label-V2-Hypothese",
      foundationDescription: "Transparenz der Zutaten · festgelegte Quelle · überprüfbarer Kontext",
      swatchesLabel: "Semantische Farbrollen des Living Labels",
      canvas: "Hintergrund",
      surface: "Oberfläche",
      action: "Aktion",
      evidence: "Evidenz",
    },
    actions: {
      buttons: "Schaltflächenzustände",
      primary: "Primär",
      secondary: "Sekundär",
      quiet: "Zurückhaltend",
      destructive: "Löschen",
      small: "Klein",
      medium: "Mittel",
      large: "Groß",
      loading: "Wird gespeichert…",
      disabled: "Nicht verfügbar",
      fullWidth: "Über die gesamte verfügbare Breite mit der Überprüfung fortfahren",
      defaultField: "Produktname",
      defaultPlaceholder: "Einen Produktnamen eingeben…",
      invalidField: "Erforderliche Quelle",
      invalidValue: "Nicht verifizierte Quelle",
      requiredError: "Fügen Sie eine Quelle hinzu, die eine andere Person überprüfen kann.",
      hintField: "Hinweis zur Quelle",
      hint: "Verwenden Sie höchstens 100 Zeichen.",
      searchField: "Suche",
      searchPlaceholder: "Zutaten und Produkte durchsuchen…",
      disabledField: "Gesperrter Datensatz",
      disabledValue: "Dieser überprüfte Wert kann nicht bearbeitet werden.",
      category: "Kategorie",
      chooseCategory: "Eine Kategorie auswählen…",
      categoryOptions: ["Snacks", "Getränke", "Frühstücksprodukte"],
      notes: "Hinweise für die Überprüfung",
      notesHint: "Optionaler Kontext für die nächste prüfende Person.",
      notesValue: "Verpackungskennzeichnung und Quelldatum bleiben neben diesem Hinweis sichtbar.",
      controls: "Auswahlsteuerelemente",
      switchOff: "Automatische Aktualisierungen deaktiviert",
      switchOn: "Automatische Aktualisierungen aktiviert",
      checkboxDefault: "Quellenkontext einbeziehen",
      checkboxChecked: "Konfidenz anzeigen",
      checkboxMixed: "Ein Teil der Evidenz ist ausgewählt",
    },
    interaction: {
      iconButtons: "Darstellung von Symbolaktionen",
      edit: "Bearbeiten",
      remove: "Löschen",
      settings: "Einstellungen",
      copy: "Evidenzverknüpfung kopieren",
      tooltipCues: "Platzierungsdiagramme",
      tooltipTop: "Erscheint oberhalb",
      tooltipRight: "Erscheint auf der rechten Seite",
      tooltipBottom: "Erscheint unterhalb",
      tooltipLeft: "Erscheint auf der linken Seite",
      alerts: "Rückmeldungen",
      alertInfoTitle: "Information",
      alertInfoBody: "Die Quelle ist verfügbar und kann überprüft werden.",
      alertSuccessTitle: "Gespeichert",
      alertSuccessBody: "Der Evidenzdatensatz wurde erfolgreich aktualisiert.",
      alertWarningTitle: "Überprüfung erforderlich",
      alertWarningBody: "Die Konfidenz ist begrenzt; prüfen Sie die Quelle vor einer Entscheidung.",
      alertErrorTitle: "Speichern nicht möglich",
      alertErrorBody: "Ihre Änderungen sind weiterhin vorhanden. Versuchen Sie es nach Wiederherstellung der Verbindung erneut.",
    },
    evidence: {
      scoreBands: "Bewertungsbereiche (1–100)",
      scoreLabels: ["Ausgezeichnet", "Hoch", "Mittel", "Niedrig", "Sehr niedrig", "Nicht verfügbar"],
      nutriScore: "Nutri-Score-Stufen",
      novaGroups: "NOVA-Gruppen",
      novaLabels: ["Unverarbeitet", "Verarbeitete Zutaten", "Verarbeitet", "Hoch verarbeitet", "Unbekannt"],
      confidence: "Konfidenz",
      confidenceLabels: ["Verifiziert 95%", "Geschätzt 65%", "Begrenzt 30%", "Unbekannt"],
      nutrition: "Je 100 g",
      nutrientLabels: ["Fett 2,5 g", "Gesättigte Fettsäuren 8 g", "Zucker 15 g", "Salz 0,3 g"],
      nutritionLevels: ["Niedrig", "Mittel", "Hoch"],
      allergenStatus: "Allergenevidenz",
      allergenLabels: ["Enthält", "Kann enthalten", "Abgeleitet", "Unbekannt", "Als nicht vorhanden bewertet"],
      allergenNames: ["Gluten", "Milch", "Ei", "Soja", "Nüsse"],
      fixtureDescription: "Eine festgelegte Quelle, Konfidenz und Erklärung machen diesen Zustand nachvollziehbar.",
      sourceChecked: "Quelle geprüft",
      source: "Quelle",
      sourceValue: "Zutatenverzeichnis auf der Verpackung",
      observed: "Beobachtet am",
      status: "Status",
      statusValue: "Nachvollziehbar und zur Überprüfung bereit",
    },
    fixtureNote: "Nur Prüfmaterial — dieser Katalog ist keine freigegebene Produktionsreferenz.",
  },
};

export function getCatalogCopy(language: SupportedLanguage): CatalogCopy {
  return catalogCopy[language];
}
