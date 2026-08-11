import type { SupportedLanguage } from "@/stores/language-store";

export const catalogSceneIds = [
  "foundations",
  "actions-forms",
  "overlays-navigation",
  "evidence-page-states",
] as const;

export type CatalogSceneId = (typeof catalogSceneIds)[number];

interface FoundationCopy {
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
  readonly switchLabel: string;
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

interface PrimitiveCopy {
  readonly surfaces: string;
  readonly cardLinkTitle: string;
  readonly cardLinkDescription: string;
  readonly cardLinkAction: string;
  readonly cardLinkSecondaryAction: string;
  readonly activated: string;
  readonly requiredLabel: string;
  readonly comboboxLabel: string;
  readonly comboboxHint: string;
  readonly comboboxPlaceholder: string;
  readonly comboboxOptions: readonly [string, string, string];
  readonly comboboxLoading: string;
  readonly comboboxEmpty: string;
  readonly comboboxError: string;
  readonly comboboxResults: string;
  readonly dialogTrigger: string;
  readonly dialogTitle: string;
  readonly dialogDescription: string;
  readonly dialogBody: string;
  readonly dialogClose: string;
  readonly dialogInitialAction: string;
  readonly dialogLastAction: string;
  readonly sheetTrigger: string;
  readonly sheetTitle: string;
  readonly sheetDescription: string;
  readonly sheetBody: string;
  readonly sheetClose: string;
  readonly sheetInitialAction: string;
  readonly sheetLastAction: string;
  readonly menuTrigger: string;
  readonly menuItems: readonly [string, string, string, string];
  readonly tabsLabel: string;
  readonly tabs: readonly [string, string, string];
  readonly tabPanels: readonly [string, string, string];
  readonly tooltipTrigger: string;
  readonly tooltipContent: string;
  readonly pageStates: string;
  readonly pageStateTitles: readonly [string, string, string, string, string, string, string];
  readonly pageStateDescriptions: readonly [string, string, string, string, string, string, string];
  readonly retry: string;
  readonly recoveryAction: string;
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
  readonly primitives: PrimitiveCopy;
  readonly fixtureNote: string;
}

const catalogCopy: Readonly<Record<SupportedLanguage, CatalogCopy>> = {
  en: {
    title: "Canonical primitive foundation catalog",
    description:
      "Deterministic, data-independent specimens for reviewing canonical V2 behavior while visual recipes remain provisional.",
    sceneNavigationLabel: "Catalog scenes",
    scenes: {
      foundations: "Foundations and semantic roles",
      "actions-forms": "Action and form specimens",
      "overlays-navigation": "Overlays and keyboard navigation",
      "evidence-page-states": "Evidence semantics and status states",
    },
    specimenLabel: "Canonical V2 behavior specimen",
    specimenNote:
      "Canonical behavior is under foundation review; every visual recipe remains provisional and themeable.",
    feedbackLabels: ["Information", "Success", "Warning", "Error", "Neutral"],
    chipLabels: ["Neutral", "Action", "Success", "Warning", "Error", "Information", "Subtle"],
    foundation: {
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
      switchLabel: "Automatic updates",
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
    primitives: {
      surfaces: "Canonical surfaces and linked cards",
      cardLinkTitle: "Review oat drink evidence",
      cardLinkDescription:
        "Open the complete evidence record without nesting the separate save action inside the link.",
      cardLinkAction: "Open evidence",
      cardLinkSecondaryAction: "Save for later",
      activated: "Keyboard activations",
      requiredLabel: "Required",
      comboboxLabel: "Evidence source",
      comboboxHint: "Type or use the arrow keys, then confirm one reviewable source.",
      comboboxPlaceholder: "Choose an evidence source…",
      comboboxOptions: ["Package ingredient panel", "Manufacturer specification", "Verified retailer record"],
      comboboxLoading: "Loading evidence sources…",
      comboboxEmpty: "No matching evidence sources.",
      comboboxError: "Evidence sources could not be loaded. Try again.",
      comboboxResults: "{count} evidence sources available.",
      dialogTrigger: "Review confirmation dialog",
      dialogTitle: "Confirm the evidence review",
      dialogDescription: "Focus stays inside this dialog until it is dismissed.",
      dialogBody:
        "The source, observation date, and confidence explanation remain visible before confirmation.",
      dialogClose: "Close dialog",
      dialogInitialAction: "Confirm review",
      dialogLastAction: "Keep editing",
      sheetTrigger: "Open evidence details sheet",
      sheetTitle: "Evidence details",
      sheetDescription: "A compact overlay for supporting information and recovery actions.",
      sheetBody:
        "Long evidence text wraps without hiding the source or forcing horizontal scrolling.",
      sheetClose: "Close sheet",
      sheetInitialAction: "Use this source",
      sheetLastAction: "Return to results",
      menuTrigger: "Open evidence actions",
      menuItems: ["Open source", "Copy evidence link", "Include review history", "Unavailable action"],
      tabsLabel: "Evidence record sections",
      tabs: ["Summary", "Sources", "History"],
      tabPanels: [
        "A concise explanation of the current evidence state.",
        "Source type, observation date, and confidence remain inspectable.",
        "Review history remains separate from the current conclusion.",
      ],
      tooltipTrigger: "Explain confidence",
      tooltipContent: "Confidence describes source quality; it does not replace the evidence status.",
      pageStates: "Complete page-state hierarchy",
      pageStateTitles: ["Loading evidence", "No evidence yet", "Could not load evidence", "You are offline", "Limited evidence available", "Review paused", "Recovering evidence"],
      pageStateDescriptions: [
        "The final information state appears immediately when reduced motion is requested.",
        "Add or locate a source before drawing a conclusion.",
        "The current work remains available while the request is retried.",
        "Reconnect to refresh this record; cached context remains clearly labelled.",
        "Some sources are unavailable, so the visible conclusion remains explicitly limited.",
        "The review can continue later without presenting an unfinished conclusion as final.",
        "The retry is active and preserved context remains visible until the result arrives.",
      ],
      retry: "Try again",
      recoveryAction: "Review available context",
    },
    fixtureNote: "Candidate evidence only — this catalog is not an approved production baseline.",
  },
  pl: {
    title: "Katalog podstaw komponentów docelowych",
    description:
      "Deterministyczne, niezależne od danych przykłady do oceny docelowego zachowania V2, gdy przepisy wizualne pozostają tymczasowe.",
    sceneNavigationLabel: "Sceny katalogu",
    scenes: {
      foundations: "Podstawy i role semantyczne",
      "actions-forms": "Przykłady akcji i formularzy",
      "overlays-navigation": "Nakładki i nawigacja klawiaturą",
      "evidence-page-states": "Semantyka dowodów i stany informacji",
    },
    specimenLabel: "Przykład docelowego zachowania V2",
    specimenNote:
      "Docelowe zachowanie jest oceniane jako podstawa; każdy przepis wizualny pozostaje tymczasowy i zależny od motywu.",
    feedbackLabels: ["Informacja", "Sukces", "Ostrzeżenie", "Błąd", "Neutralny"],
    chipLabels: ["Neutralny", "Akcja", "Sukces", "Ostrzeżenie", "Błąd", "Informacja", "Subtelny"],
    foundation: {
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
      switchLabel: "Automatyczne aktualizacje",
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
    primitives: {
      surfaces: "Docelowe powierzchnie i karty z odsyłaczem",
      cardLinkTitle: "Sprawdź dowody dotyczące napoju owsianego",
      cardLinkDescription:
        "Otwórz pełny zapis dowodów bez zagnieżdżania oddzielnej akcji zapisu wewnątrz odsyłacza.",
      cardLinkAction: "Otwórz dowody",
      cardLinkSecondaryAction: "Zapisz na później",
      activated: "Aktywacje klawiaturą",
      requiredLabel: "Wymagane",
      comboboxLabel: "Źródło dowodów",
      comboboxHint: "Pisz lub użyj klawiszy strzałek, a następnie zatwierdź jedno sprawdzalne źródło.",
      comboboxPlaceholder: "Wybierz źródło dowodów…",
      comboboxOptions: ["Wykaz składników na opakowaniu", "Specyfikacja producenta", "Zweryfikowany zapis sprzedawcy"],
      comboboxLoading: "Wczytywanie źródeł dowodów…",
      comboboxEmpty: "Brak pasujących źródeł dowodów.",
      comboboxError: "Nie udało się wczytać źródeł dowodów. Spróbuj ponownie.",
      comboboxResults: "Dostępne źródła dowodów: {count}.",
      dialogTrigger: "Sprawdź okno potwierdzenia",
      dialogTitle: "Potwierdź weryfikację dowodów",
      dialogDescription: "Do chwili zamknięcia fokus pozostaje wewnątrz tego okna.",
      dialogBody:
        "Źródło, data obserwacji i wyjaśnienie poziomu pewności pozostają widoczne przed potwierdzeniem.",
      dialogClose: "Zamknij okno",
      dialogInitialAction: "Potwierdź weryfikację",
      dialogLastAction: "Kontynuuj edycję",
      sheetTrigger: "Otwórz panel szczegółów dowodu",
      sheetTitle: "Szczegóły dowodu",
      sheetDescription: "Kompaktowa nakładka z informacjami pomocniczymi i działaniami naprawczymi.",
      sheetBody:
        "Długi tekst dowodu zawija się bez ukrywania źródła i bez wymuszania przewijania poziomego.",
      sheetClose: "Zamknij panel",
      sheetInitialAction: "Użyj tego źródła",
      sheetLastAction: "Wróć do wyników",
      menuTrigger: "Otwórz działania dotyczące dowodu",
      menuItems: ["Otwórz źródło", "Kopiuj odsyłacz do dowodu", "Uwzględnij historię weryfikacji", "Działanie niedostępne"],
      tabsLabel: "Sekcje zapisu dowodów",
      tabs: ["Podsumowanie", "Źródła", "Historia"],
      tabPanels: [
        "Zwięzłe wyjaśnienie bieżącego stanu dowodów.",
        "Typ źródła, data obserwacji i poziom pewności pozostają możliwe do sprawdzenia.",
        "Historia weryfikacji pozostaje oddzielona od bieżącego wniosku.",
      ],
      tooltipTrigger: "Wyjaśnij poziom pewności",
      tooltipContent: "Pewność opisuje jakość źródła; nie zastępuje stanu dowodów.",
      pageStates: "Pełna hierarchia stanów strony",
      pageStateTitles: ["Ładowanie dowodów", "Brak dowodów", "Nie udało się załadować dowodów", "Brak połączenia", "Dostępne są ograniczone dowody", "Weryfikacja wstrzymana", "Przywracanie dowodów"],
      pageStateDescriptions: [
        "Końcowy stan informacji pojawia się natychmiast, gdy użytkownik ogranicza ruch.",
        "Dodaj lub znajdź źródło, zanim wyciągniesz wniosek.",
        "Bieżąca praca pozostaje dostępna podczas ponowienia żądania.",
        "Połącz się ponownie, aby odświeżyć zapis; kontekst z pamięci podręcznej pozostaje wyraźnie oznaczony.",
        "Część źródeł jest niedostępna, dlatego widoczny wniosek pozostaje jednoznacznie ograniczony.",
        "Weryfikację można kontynuować później bez przedstawiania niedokończonego wniosku jako ostatecznego.",
        "Ponowienie jest aktywne, a zachowany kontekst pozostaje widoczny do chwili otrzymania wyniku.",
      ],
      retry: "Spróbuj ponownie",
      recoveryAction: "Sprawdź dostępny kontekst",
    },
    fixtureNote: "Wyłącznie materiał roboczy — ten katalog nie jest zatwierdzoną bazą produkcyjną.",
  },
  de: {
    title: "Grundlagenkatalog der verbindlichen Komponenten",
    description:
      "Deterministische, datenunabhängige Beispiele zur Prüfung des verbindlichen V2-Verhaltens, während visuelle Ausgestaltungen vorläufig bleiben.",
    sceneNavigationLabel: "Katalogszenen",
    scenes: {
      foundations: "Grundlagen und semantische Rollen",
      "actions-forms": "Aktions- und Formularbeispiele",
      "overlays-navigation": "Überlagerungen und Tastaturnavigation",
      "evidence-page-states": "Evidenzsemantik und Informationszustände",
    },
    specimenLabel: "Beispiel für verbindliches V2-Verhalten",
    specimenNote:
      "Das verbindliche Verhalten wird als Grundlage geprüft; jede visuelle Ausgestaltung bleibt vorläufig und themenfähig.",
    feedbackLabels: ["Information", "Erfolg", "Warnung", "Fehler", "Neutral"],
    chipLabels: ["Neutral", "Aktion", "Erfolg", "Warnung", "Fehler", "Information", "Dezent"],
    foundation: {
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
      switchLabel: "Automatische Aktualisierungen",
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
    primitives: {
      surfaces: "Verbindliche Oberflächen und verknüpfte Karten",
      cardLinkTitle: "Evidenz zum Hafergetränk prüfen",
      cardLinkDescription:
        "Den vollständigen Evidenzdatensatz öffnen, ohne die getrennte Speicheraktion innerhalb der Verknüpfung zu verschachteln.",
      cardLinkAction: "Evidenz öffnen",
      cardLinkSecondaryAction: "Für später speichern",
      activated: "Tastaturaktivierungen",
      requiredLabel: "Erforderlich",
      comboboxLabel: "Evidenzquelle",
      comboboxHint: "Tippen oder die Pfeiltasten verwenden und anschließend eine überprüfbare Quelle bestätigen.",
      comboboxPlaceholder: "Eine Evidenzquelle auswählen…",
      comboboxOptions: ["Zutatenverzeichnis auf der Verpackung", "Herstellerspezifikation", "Verifizierter Händlerdatensatz"],
      comboboxLoading: "Evidenzquellen werden geladen…",
      comboboxEmpty: "Keine passenden Evidenzquellen.",
      comboboxError: "Evidenzquellen konnten nicht geladen werden. Bitte erneut versuchen.",
      comboboxResults: "{count} Evidenzquellen verfügbar.",
      dialogTrigger: "Bestätigungsdialog prüfen",
      dialogTitle: "Evidenzprüfung bestätigen",
      dialogDescription: "Der Fokus bleibt bis zum Schließen innerhalb dieses Dialogs.",
      dialogBody:
        "Quelle, Beobachtungsdatum und Erklärung der Konfidenz bleiben vor der Bestätigung sichtbar.",
      dialogClose: "Dialog schließen",
      dialogInitialAction: "Prüfung bestätigen",
      dialogLastAction: "Weiter bearbeiten",
      sheetTrigger: "Detailbereich der Evidenz öffnen",
      sheetTitle: "Evidenzdetails",
      sheetDescription: "Eine kompakte Überlagerung für ergänzende Informationen und Wiederherstellungsaktionen.",
      sheetBody:
        "Langer Evidenztext wird umgebrochen, ohne die Quelle zu verbergen oder horizontales Scrollen zu erzwingen.",
      sheetClose: "Detailbereich schließen",
      sheetInitialAction: "Diese Quelle verwenden",
      sheetLastAction: "Zu den Ergebnissen zurückkehren",
      menuTrigger: "Evidenzaktionen öffnen",
      menuItems: ["Quelle öffnen", "Evidenzverknüpfung kopieren", "Prüfverlauf einbeziehen", "Nicht verfügbare Aktion"],
      tabsLabel: "Abschnitte des Evidenzdatensatzes",
      tabs: ["Zusammenfassung", "Quellen", "Verlauf"],
      tabPanels: [
        "Eine prägnante Erklärung des aktuellen Evidenzzustands.",
        "Quellentyp, Beobachtungsdatum und Konfidenz bleiben überprüfbar.",
        "Der Prüfverlauf bleibt von der aktuellen Schlussfolgerung getrennt.",
      ],
      tooltipTrigger: "Konfidenz erklären",
      tooltipContent: "Konfidenz beschreibt die Quellenqualität; sie ersetzt nicht den Evidenzstatus.",
      pageStates: "Vollständige Hierarchie der Seitenzustände",
      pageStateTitles: ["Evidenz wird geladen", "Noch keine Evidenz", "Evidenz konnte nicht geladen werden", "Sie sind offline", "Begrenzte Evidenz verfügbar", "Prüfung pausiert", "Evidenz wird wiederhergestellt"],
      pageStateDescriptions: [
        "Der endgültige Informationszustand erscheint sofort, wenn reduzierte Bewegung angefordert wird.",
        "Eine Quelle hinzufügen oder finden, bevor eine Schlussfolgerung gezogen wird.",
        "Die aktuelle Arbeit bleibt während des erneuten Versuchs verfügbar.",
        "Erneut verbinden, um diesen Datensatz zu aktualisieren; zwischengespeicherter Kontext bleibt klar gekennzeichnet.",
        "Einige Quellen sind nicht verfügbar, daher bleibt die sichtbare Schlussfolgerung ausdrücklich eingeschränkt.",
        "Die Prüfung kann später fortgesetzt werden, ohne eine unfertige Schlussfolgerung als endgültig darzustellen.",
        "Der erneute Versuch läuft und der erhaltene Kontext bleibt sichtbar, bis das Ergebnis eintrifft.",
      ],
      retry: "Erneut versuchen",
      recoveryAction: "Verfügbaren Kontext prüfen",
    },
    fixtureNote: "Nur Prüfmaterial — dieser Katalog ist keine freigegebene Produktionsreferenz.",
  },
};

export function getCatalogCopy(language: SupportedLanguage): CatalogCopy {
  return catalogCopy[language];
}
