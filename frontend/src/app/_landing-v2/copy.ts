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
    eyebrow: "Food intelligence you can inspect",
    title: "Read the package. See the reasoning. Make your own call.",
    liveIntro:
      "TryVit separates label facts from calculations, context, and decisions—so confidence and missing evidence stay visible.",
    demoIntro:
      "TryVit separates label facts from calculations, context, and decisions. The method remains available while live product data is paused.",
    primary: "Explore the evidence",
    secondary: "Create an account",
    package: "Package source",
    observed: "Observed facts",
    derived: "Derived interpretation",
    contextual: "Applied context",
    decision: "Decision and next action",
    decode: "Unfold the evidence",
    reset: "Fold back to source",
    packageName: "Oat drink",
    synthetic: "Synthetic example",
    evidenceTitle: "One answer, four accountable layers",
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
    methodTitle: "Method before mystique",
    methodBody:
      "Observed package facts stay separate from calculated results. A method version, source date, and missing-input state travel with every conclusion.",
    marketTitle: "Designed for European labels",
    marketBody:
      "Polish and German copy, metric units, serving-basis differences, and incomplete records are interface requirements—not footnotes after launch.",
    privacyTitle: "Private before personal",
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
    finalEyebrow: "Keep the proof attached",
    finalTitle: "Start with the question—not a verdict.",
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
    eyebrow: "Dane o żywności, które można sprawdzić",
    title: "Odczytaj opakowanie. Poznaj tok rozumowania. Podejmij własną decyzję.",
    liveIntro:
      "TryVit oddziela dane z etykiety od obliczeń, kontekstu i decyzji—wiarygodność i brakujące informacje pozostają widoczne.",
    demoIntro:
      "TryVit oddziela dane z etykiety od obliczeń, kontekstu i decyzji. Metoda pozostaje dostępna, gdy dane produktów na żywo są wstrzymane.",
    primary: "Przejrzyj dane",
    secondary: "Utwórz konto",
    package: "Źródło na opakowaniu",
    observed: "Dane z opakowania",
    derived: "Wyliczona interpretacja",
    contextual: "Zastosowany kontekst",
    decision: "Decyzja i następny krok",
    decode: "Rozwiń dane",
    reset: "Wróć do źródła",
    packageName: "Napój owsiany",
    synthetic: "Przykład syntetyczny",
    evidenceTitle: "Jedna odpowiedź, cztery rozliczalne warstwy",
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
    methodTitle: "Najpierw metoda, potem efekt",
    methodBody:
      "Dane z opakowania pozostają oddzielone od obliczeń. Wersja metody, data źródła i brakujące informacje towarzyszą każdemu wnioskowi.",
    marketTitle: "Projektowany dla europejskich etykiet",
    marketBody:
      "Polskie i niemieckie teksty, jednostki metryczne, różne porcje i niepełne rekordy są wymaganiami interfejsu, a nie późniejszym przypisem.",
    privacyTitle: "Prywatność przed personalizacją",
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
    finalEyebrow: "Zachowaj dostęp do danych",
    finalTitle: "Zacznij od pytania, nie od werdyktu.",
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
    eyebrow: "Nachprüfbare Lebensmittelinformation",
    title: "Verpackung lesen. Begründung verstehen. Selbst entscheiden.",
    liveIntro:
      "TryVit trennt Verpackungsangaben von Berechnungen, Kontext und Entscheidungen—Datenverlässlichkeit und fehlende Evidenz bleiben sichtbar.",
    demoIntro:
      "TryVit trennt Verpackungsangaben von Berechnungen, Kontext und Entscheidungen. Die Methode bleibt verfügbar, während Live-Produktdaten pausiert sind.",
    primary: "Evidenz erkunden",
    secondary: "Konto erstellen",
    package: "Verpackungsquelle",
    observed: "Verpackungsangaben",
    derived: "Abgeleitete Einordnung",
    contextual: "Angewandter Kontext",
    decision: "Entscheidung und nächster Schritt",
    decode: "Evidenz entfalten",
    reset: "Zur Quelle zurückfalten",
    packageName: "Haferdrink",
    synthetic: "Synthetisches Beispiel",
    evidenceTitle: "Eine Antwort, vier nachvollziehbare Ebenen",
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
    methodTitle: "Methode vor Inszenierung",
    methodBody:
      "Beobachtete Verpackungsangaben bleiben von Berechnungen getrennt. Methodenversion, Quelldatum und fehlende Eingaben begleiten jede Schlussfolgerung.",
    marketTitle: "Für europäische Etiketten gestaltet",
    marketBody:
      "Polnische und deutsche Textlängen, metrische Einheiten, Bezugsgrößen und unvollständige Datensätze sind Anforderungen an die Oberfläche—keine spätere Fußnote.",
    privacyTitle: "Datenschutz vor Personalisierung",
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
    finalEyebrow: "Den Nachweis verbunden lassen",
    finalTitle: "Mit einer Frage beginnen—nicht mit einem Urteil.",
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
