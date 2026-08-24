import { PageState } from "@/design-system/patterns/PageState/PageState";
import { Tabs } from "@/design-system/primitives/Tabs";

import { GOLDEN_COMMON_COPY } from "./common-copy";
import type { GoldenRouteState } from "./contract";
import { DecisionSummary, EvidenceBand } from "./GoldenEvidence";
import { GoldenGlyph } from "./GoldenGlyph";
import { GoldenSurfaceOwner } from "./GoldenIdentity";
import { ProductActions } from "./ProductActions.client";
import styles from "./golden.module.css";

const PRODUCT_COPY = {
  en: {
    productName: "North Grain Oat Drink — review fixture",
    eyebrow: "Product record · synthetic fixture",
    source: "One package transcription · observed 14 July 2026",
    decision: "Review before deciding",
    partialReason: "Processing is not assessed; the current score uses incomplete inputs.",
    unknownReason: "A required method input is unavailable, so no score is shown.",
    staleReason: "The package record is older than the review freshness target.",
    availableReason: "Nutrition and ingredient inputs are available; one source transcription remains unverified.",
    inspect: "Inspect evidence",
    provenance: "Open provenance",
    provenanceTitle: "Source and method provenance",
    provenanceDescription: "Why the current record has moderate data confidence.",
    provenanceUnknownDescription: "Why data confidence is not assessed for the current record.",
    provenanceBody: "This review fixture was transcribed once from a synthetic package. No independent package, laboratory, or regulatory check is attached.",
    compare: "Comparison actions",
    addCompare: "Add to local comparison",
    openAlternative: "Open comparable alternative",
    saved: "Added to the local comparison with method and confidence attached.",
    nutrition: "Nutrition",
    ingredients: "Ingredients",
    allergens: "Allergens",
    method: "Method",
    alternatives: "Alternatives",
    nutritionDetail: "Per 100 ml · energy 193 kJ / 46 kcal · fat 1.5 g · sugars 3.2 g · salt 0.10 g",
    ingredientDetail: "Water, oats 11%, rapeseed oil, calcium carbonate, salt.",
    allergenDetail: "Oats are ingredient-derived. Soy is an explicit may-contain statement. All other absence is not assessed.",
    methodDetail: "Review method v0.9 · concept only · derived score uses incomplete processing input.",
    alternativesDetail: "Only records in the oat-drink fixture with the same per-100-ml basis and method are comparable. Incompatible records remain unranked.",
    observedTitle: "Sugars on the package",
    observedDetail: "3.2 g per 100 ml, transcribed from the synthetic nutrition table.",
    derivedTitle: "Concept decision score",
    derivedDetail: "72 / 100 from review method v0.9. Processing classification is missing.",
    unknownDerivedTitle: "Concept decision score not assessed",
    unknownDerivedDetail: "A required processing input is unavailable, so no score has been calculated or shown.",
    contextTitle: "Comparable serving basis",
    contextDetail: "Oat drinks compared per 100 ml under the same review method.",
    decisionTitle: "Check the package and missing input",
    decisionDetail: "Do not interpret the incomplete score as a complete product assessment.",
    loadingTitle: "Preparing the product record",
    errorTitle: "The derived record could not be prepared",
    errorDetail: "Observed package facts remain available. Retry only the failed derived layer.",
    offlineTitle: "Offline product record",
    offlineDetail: "Retained observed facts and source date remain available; fresh comparison is unavailable.",
    staleTitle: "This record may be stale",
    degradedTitle: "Derived evidence is temporarily incomplete",
    degradedDetail: "Observed package facts remain available. Retry the derived layer before relying on a score or comparison.",
    fixtureLabel: "Fixture",
    observedLabel: "Observed",
    checksLabel: "Source checks",
    noChecksLabel: "0 independent",
  },
  pl: {
    productName: "Napój owsiany North Grain — rekord testowy",
    eyebrow: "Rekord produktu · materiał syntetyczny",
    source: "Jeden zapis z opakowania · 14 lipca 2026",
    decision: "Sprawdź przed decyzją",
    partialReason: "Nie oceniono przetworzenia; obecny wynik korzysta z niepełnych danych.",
    unknownReason: "Wymagana dana metody jest niedostępna, dlatego wynik nie jest wyświetlany.",
    staleReason: "Rekord opakowania jest starszy niż docelowa data aktualności.",
    availableReason: "Dane żywieniowe i składniki są dostępne; pojedynczy zapis źródłowy nie został niezależnie sprawdzony.",
    inspect: "Przejrzyj dane",
    provenance: "Otwórz pochodzenie danych",
    provenanceTitle: "Pochodzenie źródła i metody",
    provenanceDescription: "Dlaczego rekord ma umiarkowaną wiarygodność danych.",
    provenanceUnknownDescription: "Dlaczego wiarygodności danych nie oceniono dla tego rekordu.",
    provenanceBody: "Materiał testowy zapisano raz z syntetycznego opakowania. Nie dołączono niezależnej kontroli opakowania, laboratorium ani organu regulacyjnego.",
    compare: "Działania porównania",
    addCompare: "Dodaj do lokalnego porównania",
    openAlternative: "Otwórz porównywalną alternatywę",
    saved: "Dodano do lokalnego porównania wraz z metodą i wiarygodnością.",
    nutrition: "Wartości odżywcze",
    ingredients: "Składniki",
    allergens: "Alergeny",
    method: "Metoda",
    alternatives: "Alternatywy",
    nutritionDetail: "Na 100 ml · energia 193 kJ / 46 kcal · tłuszcz 1,5 g · cukry 3,2 g · sól 0,10 g",
    ingredientDetail: "Woda, owies 11%, olej rzepakowy, węglan wapnia, sól.",
    allergenDetail: "Owies wyliczono ze składników. Soja to jawna informacja »może zawierać«. Braku pozostałych alergenów nie oceniono.",
    methodDetail: "Metoda przeglądowa v0.9 · wyłącznie koncepcja · wyliczony wynik ma niepełne dane o przetworzeniu.",
    alternativesDetail: "Porównywalne są tylko rekordy napojów owsianych z tą samą podstawą 100 ml i metodą. Niezgodne rekordy pozostają bez rankingu.",
    observedTitle: "Cukry na opakowaniu",
    observedDetail: "3,2 g na 100 ml, zapisane z syntetycznej tabeli żywieniowej.",
    derivedTitle: "Koncepcyjny wynik decyzji",
    derivedDetail: "72 / 100 według metody v0.9. Brakuje klasyfikacji przetworzenia.",
    unknownDerivedTitle: "Nie oceniono koncepcyjnego wyniku decyzji",
    unknownDerivedDetail: "Brakuje wymaganej danej o przetworzeniu, dlatego wyniku nie wyliczono ani nie wyświetlono.",
    contextTitle: "Porównywalna podstawa porcji",
    contextDetail: "Napoje owsiane porównane na 100 ml tą samą metodą.",
    decisionTitle: "Sprawdź opakowanie i brakującą daną",
    decisionDetail: "Nie traktuj niepełnego wyniku jako pełnej oceny produktu.",
    loadingTitle: "Przygotowywanie rekordu produktu",
    errorTitle: "Nie udało się przygotować wyliczonego rekordu",
    errorDetail: "Dane z opakowania pozostają dostępne. Ponów tylko nieudany etap wyliczenia.",
    offlineTitle: "Rekord produktu offline",
    offlineDetail: "Zachowane dane z opakowania i data źródła są dostępne; nowe porównanie jest niedostępne.",
    staleTitle: "Ten rekord może być nieaktualny",
    degradedTitle: "Wyliczone dane są chwilowo niepełne",
    degradedDetail: "Dane z opakowania pozostają dostępne. Ponów warstwę wyliczoną przed użyciem wyniku lub porównania.",
    fixtureLabel: "Materiał testowy",
    observedLabel: "Data obserwacji",
    checksLabel: "Kontrole źródła",
    noChecksLabel: "0 niezależnych",
  },
  de: {
    productName: "North Grain Hafergetränk — Prüfmuster",
    eyebrow: "Produktdatensatz · synthetischer Prüfsatz",
    source: "Eine Verpackungsabschrift · beobachtet am 14. Juli 2026",
    decision: "Vor der Entscheidung prüfen",
    partialReason: "Die Verarbeitung ist nicht bewertet; der aktuelle Wert nutzt unvollständige Eingaben.",
    unknownReason: "Eine erforderliche Methodeneingabe ist nicht verfügbar; deshalb wird kein Wert gezeigt.",
    staleReason: "Der Verpackungsdatensatz ist älter als das vorgesehene Aktualitätsziel.",
    availableReason: "Nährwert- und Zutatenangaben sind verfügbar; die einzelne Quellenabschrift ist nicht unabhängig geprüft.",
    inspect: "Evidenz prüfen",
    provenance: "Provenienz öffnen",
    provenanceTitle: "Quellen- und Methodenprovenienz",
    provenanceDescription: "Warum der aktuelle Datensatz mittlere Datenverlässlichkeit hat.",
    provenanceUnknownDescription: "Warum die Datenverlässlichkeit für den aktuellen Datensatz nicht bewertet ist.",
    provenanceBody: "Der Prüfsatz wurde einmal von einer synthetischen Verpackung abgeschrieben. Es ist keine unabhängige Verpackungs-, Labor- oder Behördenprüfung verbunden.",
    compare: "Vergleichsaktionen",
    addCompare: "Zum lokalen Vergleich hinzufügen",
    openAlternative: "Vergleichbare Alternative öffnen",
    saved: "Mit Methode und Datenverlässlichkeit zum lokalen Vergleich hinzugefügt.",
    nutrition: "Nährwerte",
    ingredients: "Zutaten",
    allergens: "Allergene",
    method: "Methode",
    alternatives: "Alternativen",
    nutritionDetail: "Je 100 ml · Energie 193 kJ / 46 kcal · Fett 1,5 g · Zucker 3,2 g · Salz 0,10 g",
    ingredientDetail: "Wasser, Hafer 11%, Rapsöl, Calciumcarbonat, Salz.",
    allergenDetail: "Hafer ist aus der Zutatenliste abgeleitet. Soja ist ausdrücklich als mögliche Spur angegeben. Das Fehlen aller anderen Allergene ist nicht bewertet.",
    methodDetail: "Prüfmethode v0.9 · nur Konzept · der abgeleitete Wert nutzt eine unvollständige Verarbeitungseingabe.",
    alternativesDetail: "Nur Hafergetränke mit derselben 100-ml-Basis und Methode sind vergleichbar. Unvereinbare Datensätze bleiben ohne Rangfolge.",
    observedTitle: "Zucker auf der Verpackung",
    observedDetail: "3,2 g je 100 ml, aus der synthetischen Nährwerttabelle abgeschrieben.",
    derivedTitle: "Konzeptioneller Entscheidungswert",
    derivedDetail: "72 / 100 nach Prüfmethode v0.9. Die Verarbeitungsklassifikation fehlt.",
    unknownDerivedTitle: "Konzeptioneller Entscheidungswert nicht bewertet",
    unknownDerivedDetail: "Eine erforderliche Verarbeitungseingabe fehlt; deshalb wurde kein Wert berechnet oder gezeigt.",
    contextTitle: "Vergleichbare Bezugsgröße",
    contextDetail: "Hafergetränke je 100 ml mit derselben Prüfmethode verglichen.",
    decisionTitle: "Verpackung und fehlende Eingabe prüfen",
    decisionDetail: "Den unvollständigen Wert nicht als vollständige Produktbewertung verstehen.",
    loadingTitle: "Produktdatensatz wird vorbereitet",
    errorTitle: "Der abgeleitete Datensatz konnte nicht vorbereitet werden",
    errorDetail: "Beobachtete Verpackungsangaben bleiben verfügbar. Nur die fehlgeschlagene Ableitung erneut versuchen.",
    offlineTitle: "Offline-Produktdatensatz",
    offlineDetail: "Gespeicherte Verpackungsangaben und Quelldatum bleiben verfügbar; ein neuer Vergleich ist nicht möglich.",
    staleTitle: "Dieser Datensatz könnte veraltet sein",
    degradedTitle: "Abgeleitete Evidenz ist vorübergehend unvollständig",
    degradedDetail: "Verpackungsangaben bleiben verfügbar. Die Ableitung erneut versuchen, bevor Wert oder Vergleich verwendet werden.",
    fixtureLabel: "Prüfsatz",
    observedLabel: "Beobachtet",
    checksLabel: "Quellenprüfungen",
    noChecksLabel: "0 unabhängig",
  },
} as const;

export function ProductReference({ route }: Readonly<{ route: GoldenRouteState }>) {
  const copy = PRODUCT_COPY[route.locale];
  const common = GOLDEN_COMMON_COPY[route.locale];
  const unknown = route.state === "unknown";
  const partial = route.state === "partial" || route.state === "degraded";
  const stale = route.state === "stale" || route.state === "offline-cache";
  const query = `locale=${route.locale}&theme=${route.theme}&motion=${route.motion}${route.capture ? "&capture=1" : ""}`;
  const reason = unknown ? copy.unknownReason : stale ? copy.staleReason : partial ? copy.partialReason : copy.availableReason;
  const pageState = route.state === "loading"
    ? { status: "loading" as const, title: copy.loadingTitle, detail: copy.source }
    : route.state === "service-error"
      ? { status: "error" as const, title: copy.errorTitle, detail: copy.errorDetail }
      : route.state === "offline-cache"
        ? { status: "offline" as const, title: copy.offlineTitle, detail: copy.offlineDetail }
        : route.state === "degraded"
          ? { status: "degraded" as const, title: copy.degradedTitle, detail: copy.degradedDetail }
        : route.state === "stale"
          ? { status: "degraded" as const, title: copy.staleTitle, detail: copy.staleReason }
          : null;

  return (
    <article className={styles.productReference}>
      <header className={styles.productHeader}>
        <div><GoldenSurfaceOwner label={common.ownerLabel} /><p className={styles.eyebrow}>{copy.eyebrow}</p><h1>{copy.productName}</h1><p>{copy.source}</p></div>
        <div aria-hidden="true" className={styles.productPackage}><GoldenGlyph name="source" size={32} /><span>NORTH<br />GRAIN</span></div>
      </header>
      {pageState ? <PageState description={pageState.detail} headingLevel={2} primaryAction={<a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/product?${query}&state=available`}>{common.retry}</a>} status={pageState.status} title={pageState.title} /> : null}
      <DecisionSummary
        confidence={unknown ? common.unknown : common.confidenceValue}
        confidenceReason={unknown ? common.unknownInvariant : common.confidenceReason}
        copy={common}
        decision={copy.decision}
        mainReason={reason}
        nextAction={<ProductActions addCompareLabel={copy.addCompare} checksLabel={copy.checksLabel} closeLabel={common.close} compareLabel={copy.compare} fixtureLabel={copy.fixtureLabel} methodLabel={copy.method} noChecksLabel={copy.noChecksLabel} observedLabel={copy.observedLabel} openAlternativeLabel={copy.openAlternative} provenanceBody={copy.provenanceBody} provenanceDescription={unknown ? copy.provenanceUnknownDescription : copy.provenanceDescription} provenanceLabel={copy.provenance} provenanceTitle={copy.provenanceTitle} savedMessage={copy.saved} />}
        provisionalScore={unknown ? undefined : 72}
        score={null}
      />

      <section className={styles.productEvidence}>
        <header className={styles.sectionHeading}><p className={styles.eyebrow}>01</p><h2>{copy.inspect}</h2><p>{common.unknownInvariant}</p></header>
        <div className={styles.evidenceSpine}>
          <EvidenceBand detail={copy.observedDetail} kind="observed" label={common.observed} meta={copy.source} title={copy.observedTitle} />
          <EvidenceBand detail={unknown ? copy.unknownDerivedDetail : copy.partialReason} kind="unknown" label={common.derived} meta={unknown ? common.unknownInvariant : `${common.provisionalScore}: 72/100 · ${common.incomplete}`} title={copy.unknownDerivedTitle} />
          <EvidenceBand detail={copy.contextDetail} kind="context" label={common.contextual} meta={partial ? common.unknownInvariant : copy.alternativesDetail} title={copy.contextTitle} />
          <EvidenceBand detail={copy.decisionDetail} kind="decision" label={common.decisionLayer} meta={common.packageReminder} title={copy.decisionTitle} />
        </div>
      </section>

      <section className={styles.productTabsSection}>
        <Tabs
          activationMode="manual"
          label={copy.inspect}
          items={[
            { value: "nutrition", label: copy.nutrition, panel: <p>{copy.nutritionDetail}</p> },
            { value: "ingredients", label: copy.ingredients, panel: <p>{copy.ingredientDetail}</p> },
            { value: "allergens", label: copy.allergens, panel: <p>{copy.allergenDetail} <strong>{common.packageReminder}</strong></p> },
            { value: "method", label: copy.method, panel: <p>{copy.methodDetail}</p> },
            { value: "alternatives", label: copy.alternatives, panel: <p>{copy.alternativesDetail}</p> },
          ]}
        />
      </section>
    </article>
  );
}
