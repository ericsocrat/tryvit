import type { Metadata } from "next";

import type { DeploymentReadiness } from "@/lib/deployment-readiness";
import type { SupportedLanguage } from "@/stores/language-store";

export interface LandingCopy {
  readonly metadata: {
    readonly title: string;
    readonly liveSocialDescription: string;
    readonly demoSocialDescription: string;
  };
  readonly primaryNavigationLabel: string;
  readonly utilityNavigationLabel: string;
  readonly footerNavigationLabel: string;
  readonly navigation: {
    readonly evidence: string;
    readonly method: string;
    readonly trust: string;
    readonly learn: string;
    readonly privacy: string;
    readonly terms: string;
    readonly contact: string;
    readonly signIn: string;
    readonly dashboard: string;
    readonly statusLink: string;
    readonly theme: string;
    readonly lightTheme: string;
    readonly darkTheme: string;
  };
  readonly identityLabel: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly titleAccent: string;
  readonly accessNote: string;
  readonly features: readonly string[];
  readonly preview: {
    readonly heading: string;
    readonly basis: string;
    readonly sugars: string;
    readonly sugarValue: string;
    readonly saturatedFat: string;
    readonly saturatedFatValue: string;
    readonly missing: string;
    readonly note: string;
  };
  readonly liveIntro: string;
  readonly demoIntro: string;
  readonly primary: string;
  readonly secondary: string;
  readonly package: string;
  readonly observed: string;
  readonly derived: string;
  readonly contextual: string;
  readonly decision: string;
  readonly decode: string;
  readonly reset: string;
  readonly packageName: string;
  readonly synthetic: string;
  readonly evidenceTitle: string;
  readonly evidenceIntro: string;
  readonly observedDetail: string;
  readonly observedMeta: string;
  readonly derivedDetail: string;
  readonly derivedMeta: string;
  readonly contextDetail: string;
  readonly contextMeta: string;
  readonly decisionDetail: string;
  readonly decisionMeta: string;
  readonly methodTitle: string;
  readonly methodBody: string;
  readonly marketTitle: string;
  readonly marketBody: string;
  readonly privacyTitle: string;
  readonly privacyBody: {
    readonly live: string;
    readonly demo: string;
  };
  readonly statusEyebrow: string;
  readonly statusTitle: string;
  readonly statusBody: string;
  readonly siteStatus: string;
  readonly siteAvailable: string;
  readonly dataStatus: string;
  readonly dataPaused: string;
  readonly finalEyebrow: string;
  readonly finalTitle: string;
  readonly finalBody: string;
  readonly finalPrimary: string;
  readonly finalSecondary: string;
  readonly footerStatement: string;
  readonly copyright: string;
}

export const LANDING_COPY: Readonly<Record<SupportedLanguage, LandingCopy>> = Object.freeze({
  en: {
    metadata: {
      title: "TryVit — Food intelligence you can inspect",
      liveSocialDescription:
        "Food intelligence with the package facts, reasoning, confidence, and unknowns kept attached.",
      demoSocialDescription:
        "TryVit’s evidence-first method remains available while live product data is paused; every example is synthetic.",
    },
    primaryNavigationLabel: "Primary navigation",
    utilityNavigationLabel: "Account, service, and display",
    footerNavigationLabel: "Footer navigation",
    navigation: {
      evidence: "Evidence",
      method: "Method",
      trust: "Trust",
      learn: "Learn",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      contact: "Contact",
      signIn: "Sign in",
      dashboard: "Dashboard",
      statusLink: "Demo mode",
      theme: "Theme",
      lightTheme: "Use light theme",
      darkTheme: "Use dark theme",
    },
    identityLabel: "Food intelligence · Poland and Germany",
    eyebrow: "A fresh perspective on everyday food",
    title: "A closer look.",
    titleAccent: "A clearer choice.",
    accessNote: "Private beta · access by invitation",
    features: ["Scan a barcode", "Understand the label", "Compare similar products"],
    preview: {
      heading: "Behind the label",
      basis: "Per 100 ml · example values",
      sugars: "Sugars",
      sugarValue: "3.2 g",
      saturatedFat: "Saturated fat",
      saturatedFatValue: "0.4 g",
      missing: "Processing information missing",
      note: "An illustrative preview, not a real product assessment.",
    },
    liveIntro:
      "Scan a barcode, browse products, and compare label facts. See where the information comes from and what is still missing.",
    demoIntro:
      "TryVit separates label facts from calculations, context, and decisions. The method remains available while live product data is paused.",
    primary: "See how it works",
    secondary: "Beta access",
    package: "Package source",
    observed: "Observed facts",
    derived: "Derived interpretation",
    contextual: "Applied context",
    decision: "Decision and next action",
    decode: "Unfold the evidence",
    reset: "Fold back to source",
    packageName: "Oat drink",
    synthetic: "Synthetic example",
    evidenceTitle: "There’s more to food than the front label.",
    evidenceIntro:
      "A conclusion is useful only when you can trace what came from the package, what TryVit calculated, what context was applied, and what remains unknown.",
    observedDetail: "Sugars 3.2 g and saturated fat 0.4 g per 100 ml",
    observedMeta: "Synthetic package transcription · observed 14 July 2026",
    derivedDetail: "72 / 100 provisional method output",
    derivedMeta: "Derived · method v0.9 · incomplete inputs",
    contextDetail: "Compared on an oat-drink basis; processing is not assessed",
    contextMeta: "Moderate confidence · one material input missing",
    decisionDetail: "Check the current package and inspect the missing processing input.",
    decisionMeta: "Next action · evidence remains attached",
    methodTitle: "The reasoning, not just a rating.",
    methodBody:
      "Observed package facts stay separate from calculated results. A method version, source date, and missing-input state travel with every conclusion.",
    marketTitle: "At home in your everyday shop.",
    marketBody:
      "Polish and German copy, metric units, serving-basis differences, and incomplete records are interface requirements—not footnotes after launch.",
    privacyTitle: "Your curiosity. Your control.",
    privacyBody: {
      live:
        "This page uses a synthetic example and checks only whether you already have a TryVit session so it can show the right account action. It does not start the camera or look up product data before you choose to continue.",
      demo:
        "This demonstration does not check for an account or session, start the camera, or look up product data. Every example is synthetic, and no hosted product service is used as a fallback.",
    },
    statusEyebrow: "Current service state",
    statusTitle: "The website is available; live product data is paused",
    statusBody:
      "The method and synthetic explanation remain available. TryVit does not fall back to a hosted service when readiness is incomplete.",
    siteStatus: "Website",
    siteAvailable: "Available",
    dataStatus: "Product data",
    dataPaused: "Paused",
    finalEyebrow: "Take a little clarity with you",
    finalTitle: "Your next shop. A fresh perspective.",
    finalBody:
      "Explore the method now. Account and product actions remain clearly separated from this public explanation.",
    finalPrimary: "Review the method",
    finalSecondary: "Sign in",
    footerStatement: "Food intelligence with confidence, provenance, and unknowns kept visible.",
    copyright: "TryVit · Evidence-led food decisions",
  },
  pl: {
    metadata: {
      title: "TryVit — dane o żywności, które można sprawdzić",
      liveSocialDescription:
        "Dane o żywności z widocznym źródłem, tokiem rozumowania, wiarygodnością i brakami.",
      demoSocialDescription:
        "Metoda TryVit oparta na danych i źródłach pozostaje dostępna, gdy dane produktów na żywo są wstrzymane; wszystkie przykłady są syntetyczne.",
    },
    primaryNavigationLabel: "Główna nawigacja",
    utilityNavigationLabel: "Konto, usługa i wygląd",
    footerNavigationLabel: "Nawigacja w stopce",
    navigation: {
      evidence: "Dane",
      method: "Metoda",
      trust: "Zaufanie",
      learn: "Dowiedz się więcej",
      privacy: "Polityka prywatności",
      terms: "Warunki korzystania",
      contact: "Kontakt",
      signIn: "Zaloguj się",
      dashboard: "Panel",
      statusLink: "Tryb demonstracyjny",
      theme: "Motyw",
      lightTheme: "Włącz jasny motyw",
      darkTheme: "Włącz ciemny motyw",
    },
    identityLabel: "Dane o żywności · Polska i Niemcy",
    eyebrow: "Świeże spojrzenie na codzienną żywność",
    title: "Przyjrzyj się bliżej.",
    titleAccent: "Wybieraj świadomie.",
    accessNote: "Prywatna beta · dostęp na zaproszenie",
    features: ["Zeskanuj kod kreskowy", "Odczytaj opakowanie", "Porównaj podobne produkty"],
    preview: {
      heading: "Za etykietą",
      basis: "Na 100 ml · przykładowe wartości",
      sugars: "Cukry",
      sugarValue: "3,2 g",
      saturatedFat: "Tłuszcze nasycone",
      saturatedFatValue: "0,4 g",
      missing: "Brak danych o przetworzeniu",
      note: "Ilustracja działania, nie ocena rzeczywistego produktu.",
    },
    liveIntro:
      "Skanuj kody kreskowe, przeglądaj produkty i porównuj dane z etykiet. Sprawdź, skąd pochodzą informacje i czego jeszcze brakuje.",
    demoIntro:
      "TryVit oddziela dane z etykiety od obliczeń, kontekstu i decyzji. Metoda pozostaje dostępna, gdy dane produktów na żywo są wstrzymane.",
    primary: "Zobacz, jak to działa",
    secondary: "Dostęp do bety",
    package: "Źródło na opakowaniu",
    observed: "Dane z opakowania",
    derived: "Wyliczona interpretacja",
    contextual: "Zastosowany kontekst",
    decision: "Decyzja i następny krok",
    decode: "Rozwiń dane",
    reset: "Wróć do źródła",
    packageName: "Napój owsiany",
    synthetic: "Przykład syntetyczny",
    evidenceTitle: "Żywność to więcej niż przód opakowania.",
    evidenceIntro:
      "Wniosek jest użyteczny, gdy można sprawdzić dane z opakowania, obliczenia TryVit, zastosowany kontekst i to, czego nadal nie wiadomo.",
    observedDetail: "Cukry 3,2 g i tłuszcze nasycone 0,4 g na 100 ml",
    observedMeta: "Syntetyczny zapis z opakowania · 14 lipca 2026",
    derivedDetail: "72 / 100 · wstępny wynik metody",
    derivedMeta: "Wyliczone · metoda v0.9 · niepełne dane",
    contextDetail: "Porównanie napojów owsianych; przetworzenia nie oceniono",
    contextMeta: "Umiarkowana wiarygodność · brak jednej ważnej informacji",
    decisionDetail: "Sprawdź aktualne opakowanie i brakującą klasyfikację przetworzenia.",
    decisionMeta: "Następny krok · źródła i uzasadnienie pozostają powiązane",
    methodTitle: "Uzasadnienie, nie tylko ocena.",
    methodBody:
      "Dane z opakowania pozostają oddzielone od obliczeń. Wersja metody, data źródła i brakujące informacje towarzyszą każdemu wnioskowi.",
    marketTitle: "Blisko codziennych zakupów.",
    marketBody:
      "Polskie i niemieckie teksty, jednostki metryczne, różne porcje i niepełne rekordy są wymaganiami interfejsu, a nie późniejszym przypisem.",
    privacyTitle: "Twoja ciekawość. Twoja kontrola.",
    privacyBody: {
      live:
        "Ta strona korzysta z syntetycznego przykładu i sprawdza jedynie, czy masz już sesję TryVit, aby wyświetlić właściwe działanie dotyczące konta. Nie uruchamia aparatu ani wyszukiwania danych produktów, dopóki nie zdecydujesz się kontynuować.",
      demo:
        "Ta wersja demonstracyjna nie sprawdza konta ani sesji, nie uruchamia aparatu i nie wyszukuje danych produktów. Wszystkie przykłady są syntetyczne; usługa z danymi produktów nie jest używana awaryjnie.",
    },
    statusEyebrow: "Aktualny stan usługi",
    statusTitle: "Strona działa; dane produktów na żywo są wstrzymane",
    statusBody:
      "Metoda i syntetyczne wyjaśnienie pozostają dostępne. Przy niepełnej gotowości TryVit nie korzysta awaryjnie z usługi zewnętrznej.",
    siteStatus: "Strona",
    siteAvailable: "Dostępna",
    dataStatus: "Dane produktów",
    dataPaused: "Wstrzymane",
    finalEyebrow: "Zabierz ze sobą więcej wiedzy",
    finalTitle: "Kolejne zakupy. Świeże spojrzenie.",
    finalBody:
      "Poznaj metodę. Działania związane z kontem i produktami pozostają wyraźnie oddzielone od publicznego wyjaśnienia.",
    finalPrimary: "Poznaj metodę",
    finalSecondary: "Zaloguj się",
    footerStatement: "Dane o żywności z widoczną wiarygodnością, źródłem i brakami.",
    copyright: "TryVit · Decyzje oparte na danych",
  },
  de: {
    metadata: {
      title: "TryVit — nachprüfbare Lebensmittelinformation",
      liveSocialDescription:
        "Lebensmittelinformation mit verbundener Quelle, Begründung, Datenverlässlichkeit und offenen Fragen.",
      demoSocialDescription:
        "Die evidenzorientierte TryVit-Methode bleibt verfügbar, während Live-Produktdaten pausiert sind; alle Beispiele sind synthetisch.",
    },
    primaryNavigationLabel: "Hauptnavigation",
    utilityNavigationLabel: "Konto, Dienst und Darstellung",
    footerNavigationLabel: "Fußzeilennavigation",
    navigation: {
      evidence: "Evidenz",
      method: "Methode",
      trust: "Vertrauen",
      learn: "Mehr erfahren",
      privacy: "Datenschutzrichtlinie",
      terms: "Nutzungsbedingungen",
      contact: "Kontakt",
      signIn: "Anmelden",
      dashboard: "Dashboard",
      statusLink: "Demomodus",
      theme: "Darstellung",
      lightTheme: "Helles Design verwenden",
      darkTheme: "Dunkles Design verwenden",
    },
    identityLabel: "Lebensmittelinformation · Polen und Deutschland",
    eyebrow: "Ein frischer Blick auf alltägliche Lebensmittel",
    title: "Genauer hinsehen.",
    titleAccent: "Bewusster wählen.",
    accessNote: "Private Beta · Zugang auf Einladung",
    features: ["Barcode scannen", "Etikett verstehen", "Ähnliche Produkte vergleichen"],
    preview: {
      heading: "Hinter dem Etikett",
      basis: "Je 100 ml · Beispielwerte",
      sugars: "Zucker",
      sugarValue: "3,2 g",
      saturatedFat: "Gesättigte Fettsäuren",
      saturatedFatValue: "0,4 g",
      missing: "Angaben zur Verarbeitung fehlen",
      note: "Eine illustrative Vorschau, keine Bewertung eines realen Produkts.",
    },
    liveIntro:
      "Barcodes scannen, Produkte durchsuchen und Etikettangaben vergleichen. Sehen Sie, woher die Informationen stammen und was noch fehlt.",
    demoIntro:
      "TryVit trennt Verpackungsangaben von Berechnungen, Kontext und Entscheidungen. Die Methode bleibt verfügbar, während Live-Produktdaten pausiert sind.",
    primary: "So funktioniert’s",
    secondary: "Beta-Zugang",
    package: "Verpackungsquelle",
    observed: "Verpackungsangaben",
    derived: "Abgeleitete Einordnung",
    contextual: "Angewandter Kontext",
    decision: "Entscheidung und nächster Schritt",
    decode: "Evidenz entfalten",
    reset: "Zur Quelle zurückfalten",
    packageName: "Haferdrink",
    synthetic: "Synthetisches Beispiel",
    evidenceTitle: "Lebensmittel sind mehr als ihre Vorderseite.",
    evidenceIntro:
      "Eine Schlussfolgerung ist erst nützlich, wenn Verpackungsangaben, TryVit-Berechnung, angewandter Kontext und offene Fragen nachvollziehbar bleiben.",
    observedDetail: "3,2 g Zucker und 0,4 g gesättigte Fettsäuren je 100 ml",
    observedMeta: "Synthetische Verpackungsabschrift · 14. Juli 2026",
    derivedDetail: "72 / 100 · vorläufiges Methodenergebnis",
    derivedMeta: "Abgeleitet · Methode v0.9 · unvollständige Eingaben",
    contextDetail: "Verglichen auf Haferdrink-Basis; Verarbeitungsgrad nicht bewertet",
    contextMeta: "Mittlere Datenverlässlichkeit · eine wesentliche Angabe fehlt",
    decisionDetail: "Aktuelle Verpackung und fehlende Verarbeitungseingabe prüfen.",
    decisionMeta: "Nächster Schritt · Evidenz bleibt verbunden",
    methodTitle: "Die Gründe, nicht nur die Bewertung.",
    methodBody:
      "Beobachtete Verpackungsangaben bleiben von Berechnungen getrennt. Methodenversion, Quelldatum und fehlende Eingaben begleiten jede Schlussfolgerung.",
    marketTitle: "Für Ihren alltäglichen Einkauf.",
    marketBody:
      "Polnische und deutsche Textlängen, metrische Einheiten, Bezugsgrößen und unvollständige Datensätze sind Anforderungen an die Oberfläche—keine spätere Fußnote.",
    privacyTitle: "Ihre Neugier. Ihre Kontrolle.",
    privacyBody: {
      live:
        "Diese Seite verwendet ein synthetisches Beispiel und prüft nur, ob bereits eine TryVit-Sitzung besteht, damit sie die passende Kontoaktion anzeigen kann. Sie startet weder die Kamera noch eine Produktdatensuche, bevor Sie sich zum Fortfahren entscheiden.",
      demo:
        "Diese Demoversion prüft weder Konto noch Sitzung, startet die Kamera nicht und sucht keine Produktdaten. Alle Beispiele sind synthetisch; ein gehosteter Produktdienst wird nicht als Ausweichlösung verwendet.",
    },
    statusEyebrow: "Aktueller Dienststatus",
    statusTitle: "Die Website ist verfügbar; Live-Produktdaten sind pausiert",
    statusBody:
      "Methode und synthetische Erklärung bleiben verfügbar. Bei unvollständiger Betriebsbereitschaft nutzt TryVit keinen gehosteten Ersatzdienst.",
    siteStatus: "Website",
    siteAvailable: "Verfügbar",
    dataStatus: "Produktdaten",
    dataPaused: "Pausiert",
    finalEyebrow: "Ein bisschen mehr Klarheit mitnehmen",
    finalTitle: "Ihr nächster Einkauf. Ein frischer Blick.",
    finalBody:
      "Methode jetzt nachvollziehen. Konto- und Produktaktionen bleiben von dieser öffentlichen Erklärung klar getrennt.",
    finalPrimary: "Methode prüfen",
    finalSecondary: "Anmelden",
    footerStatement:
      "Lebensmittelinformation mit sichtbarer Datenverlässlichkeit, Herkunft und offenen Fragen.",
    copyright: "TryVit · Evidenzbasierte Lebensmittelentscheidungen",
  },
});

export function getLandingCopy(language: SupportedLanguage): LandingCopy {
  return LANDING_COPY[language];
}

export interface LandingMetadataCopy {
  readonly title: string;
  readonly description: string;
  readonly socialDescription: string;
}

export function getLandingMetadataCopy(
  language: SupportedLanguage,
  readiness: DeploymentReadiness,
): LandingMetadataCopy {
  const copy = getLandingCopy(language);
  const live = readiness.dataBackend === "available";

  return {
    title: copy.metadata.title,
    description: live ? copy.liveIntro : copy.demoIntro,
    socialDescription: live
      ? copy.metadata.liveSocialDescription
      : copy.metadata.demoSocialDescription,
  };
}

export function buildLandingMetadata(
  language: SupportedLanguage,
  readiness: DeploymentReadiness,
): Metadata {
  const copy = getLandingMetadataCopy(language, readiness);

  return {
    title: { absolute: copy.title },
    description: copy.description,
    openGraph: {
      title: copy.title,
      description: copy.socialDescription,
      images: ["/opengraph-image"],
      type: "website",
      locale: language === "pl" ? "pl_PL" : language === "de" ? "de_DE" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.socialDescription,
      images: ["/twitter-image"],
    },
  };
}
