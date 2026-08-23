"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { PageState } from "@/design-system/patterns/PageState/PageState";
import { Button } from "@/design-system/primitives/Button/Button";
import { Checkbox, Input } from "@/design-system/primitives/Field";
import { Sheet } from "@/design-system/primitives/Overlay";

import { GOLDEN_COMMON_COPY } from "./common-copy";
import { GOLDEN_REFERENCE_STATES, type GoldenRouteState } from "./contract";
import { GOLDEN_SEARCH_PRODUCTS } from "./fixture";
import { GoldenGlyph } from "./GoldenGlyph";
import styles from "./golden.module.css";

type SearchState = (typeof GOLDEN_REFERENCE_STATES.search)[number];

const SEARCH_COPY = {
  en: {
    label: "Search synthetic products",
    hint: "Try oat, North Grain, or the review EAN 5901234123457.",
    placeholder: "Product name or barcode",
    submit: "Search",
    filter: "Filters",
    close: "Close filters",
    apply: "Apply filters",
    clear: "Clear filters",
    partialFilter: "Include partial records",
    unknownFilter: "Include records without a score",
    summary: "Active filters",
    allRecords: "All three synthetic records",
    withPartial: "Partial evidence included",
    withUnknown: "Score-unavailable records included",
    noQuery: "Start with a product or barcode",
    noQueryDetail: "Recent review searches: oat drink, 5901234123457. No external product service is queried.",
    loading: "Calculating the local result set",
    results: "3 synthetic records in this fixture; 1 has no comparable score.",
    empty: "No synthetic record matches this query",
    emptyDetail: "Clear the query or filters, or continue to the deterministic scanner.",
    error: "The local search simulation stopped",
    errorDetail: "Retry the failed stage. No hosted fallback was attempted.",
    degraded: "One source is stale",
    degradedDetail: "Retained results remain visible with their recorded dates; count coverage is incomplete.",
    offline: "Showing retained offline fixtures",
    offlineDetail: "Fresh lookup is unavailable. Dates and unknown fields remain visible.",
    resultDecision: "Review",
    scoreUnavailable: "Score unavailable",
    open: "Inspect evidence",
    recent: "Recent searches",
    suggestion: "Suggested synthetic query",
  },
  pl: {
    label: "Wyszukaj produkty syntetyczne",
    hint: "Wpisz owies, North Grain albo testowy EAN 5901234123457.",
    placeholder: "Nazwa produktu lub kod kreskowy",
    submit: "Szukaj",
    filter: "Filtry",
    close: "Zamknij filtry",
    apply: "Zastosuj filtry",
    clear: "Wyczyść filtry",
    partialFilter: "Uwzględnij niepełne rekordy",
    unknownFilter: "Uwzględnij rekordy bez wyniku",
    summary: "Aktywne filtry",
    allRecords: "Wszystkie trzy rekordy syntetyczne",
    withPartial: "Uwzględniono niepełne dane",
    withUnknown: "Uwzględniono rekordy bez wyniku",
    noQuery: "Zacznij od produktu lub kodu",
    noQueryDetail: "Ostatnie wyszukiwania testowe: napój owsiany, 5901234123457. Usługa zewnętrzna nie jest używana.",
    loading: "Obliczanie lokalnego zestawu wyników",
    results: "3 rekordy syntetyczne w materiale; 1 nie ma porównywalnego wyniku.",
    empty: "Brak pasującego rekordu syntetycznego",
    emptyDetail: "Wyczyść zapytanie lub filtry albo przejdź do deterministycznego skanera.",
    error: "Lokalna symulacja wyszukiwania została przerwana",
    errorDetail: "Ponów tylko przerwany etap. Nie użyto zewnętrznej usługi awaryjnej.",
    degraded: "Jedno źródło jest nieaktualne",
    degradedDetail: "Zachowane wyniki są widoczne razem z datami; zakres licznika jest niepełny.",
    offline: "Wyświetlanie zachowanych materiałów offline",
    offlineDetail: "Nowe wyszukiwanie jest niedostępne. Daty i nieznane pola pozostają widoczne.",
    resultDecision: "Sprawdź",
    scoreUnavailable: "Wynik niedostępny",
    open: "Przejrzyj dane",
    recent: "Ostatnie wyszukiwania",
    suggestion: "Sugerowane zapytanie syntetyczne",
  },
  de: {
    label: "Synthetische Produkte suchen",
    hint: "Hafer, North Grain oder Prüf-EAN 5901234123457 eingeben.",
    placeholder: "Produktname oder Strichcode",
    submit: "Suchen",
    filter: "Filter",
    close: "Filter schließen",
    apply: "Filter anwenden",
    clear: "Filter löschen",
    partialFilter: "Unvollständige Datensätze einbeziehen",
    unknownFilter: "Datensätze ohne Wert einbeziehen",
    summary: "Aktive Filter",
    allRecords: "Alle drei synthetischen Datensätze",
    withPartial: "Teilweise Evidenz einbezogen",
    withUnknown: "Datensätze ohne Wert einbezogen",
    noQuery: "Mit Produkt oder Strichcode beginnen",
    noQueryDetail: "Letzte Prüfsuchen: Hafergetränk, 5901234123457. Kein externer Produktdienst wird abgefragt.",
    loading: "Lokale Ergebnismenge wird berechnet",
    results: "3 synthetische Datensätze in diesem Prüfsatz; 1 hat keinen vergleichbaren Wert.",
    empty: "Kein synthetischer Datensatz passt",
    emptyDetail: "Suchbegriff oder Filter löschen oder zum deterministischen Scanner wechseln.",
    error: "Die lokale Suchsimulation wurde unterbrochen",
    errorDetail: "Nur die fehlgeschlagene Stufe erneut versuchen. Kein gehosteter Ausweichdienst wurde verwendet.",
    degraded: "Eine Quelle ist veraltet",
    degradedDetail: "Gespeicherte Ergebnisse bleiben mit Datum sichtbar; die Abdeckung der Anzahl ist unvollständig.",
    offline: "Gespeicherte Offline-Prüfdaten werden gezeigt",
    offlineDetail: "Eine aktuelle Suche ist nicht verfügbar. Daten und unbekannte Felder bleiben sichtbar.",
    resultDecision: "Prüfen",
    scoreUnavailable: "Wert nicht verfügbar",
    open: "Evidenz prüfen",
    recent: "Letzte Suchen",
    suggestion: "Vorgeschlagene synthetische Suche",
  },
} as const;

function SearchFilters({
  prefix,
  includePartial,
  includeUnknown,
  onPartial,
  onUnknown,
  copy,
}: Readonly<{
  prefix: string;
  includePartial: boolean;
  includeUnknown: boolean;
  onPartial: (checked: boolean) => void;
  onUnknown: (checked: boolean) => void;
  copy: (typeof SEARCH_COPY)[keyof typeof SEARCH_COPY];
}>) {
  return (
    <fieldset className={styles.filterFields}>
      <legend>{copy.filter}</legend>
      <Checkbox checked={includePartial} id={`${prefix}-partial`} label={copy.partialFilter} onChange={(event) => onPartial(event.currentTarget.checked)} />
      <Checkbox checked={includeUnknown} id={`${prefix}-unknown`} label={copy.unknownFilter} onChange={(event) => onUnknown(event.currentTarget.checked)} />
    </fieldset>
  );
}

export function SearchWorkspace({ route }: Readonly<{ route: GoldenRouteState }>) {
  const copy = SEARCH_COPY[route.locale];
  const common = GOLDEN_COMMON_COPY[route.locale];
  const initialState = route.state as SearchState;
  const [state, setState] = useState<SearchState>(initialState);
  const [query, setQuery] = useState(["no-query", "typing", "suggestions", "suggestions-loading"].includes(initialState) ? "" : "oat");
  const [includePartial, setIncludePartial] = useState(initialState === "filters-active");
  const [includeUnknown, setIncludeUnknown] = useState(initialState === "filters-active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const generationRef = useRef(0);
  const armedRef = useRef(false);

  useEffect(() => {
    rootRef.current?.setAttribute("data-golden-client-ready", "true");
  }, [state]);

  useEffect(() => {
    if (state !== "results-loading" || !armedRef.current) return;
    const generation = ++generationRef.current;
    const timeout = window.setTimeout(() => {
      if (generationRef.current === generation) setState(query.trim() ? "results" : "empty");
    }, route.motion === "reduced" ? 0 : 240);
    return () => window.clearTimeout(timeout);
  }, [query, route.motion, state]);

  const products = useMemo(
    () => GOLDEN_SEARCH_PRODUCTS.filter((product) =>
      (includePartial || product.availability !== "partial") &&
      (includeUnknown || product.decisionScore !== null),
    ),
    [includePartial, includeUnknown],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    generationRef.current += 1;
    armedRef.current = true;
    setState(query.trim() ? "results-loading" : "no-query");
  }

  function applyFilters() {
    setState("filters-active");
    setSheetOpen(false);
  }

  const statePage = state === "no-query"
    ? { status: "empty" as const, title: copy.noQuery, detail: copy.noQueryDetail }
    : state === "results-loading" || state === "suggestions-loading"
      ? { status: "loading" as const, title: copy.loading, detail: copy.hint }
      : state === "empty"
        ? { status: "empty" as const, title: copy.empty, detail: copy.emptyDetail }
        : state === "service-error"
          ? { status: "error" as const, title: copy.error, detail: copy.errorDetail }
          : state === "offline-cache"
            ? { status: "offline" as const, title: copy.offline, detail: copy.offlineDetail }
            : null;

  return (
    <div className={styles.searchWorkspace} data-golden-client="search-workspace" data-golden-live-state={state} ref={rootRef}>
      <form className={styles.searchForm} onSubmit={submit} role="search">
        <Input
          autoComplete="off"
          hint={copy.hint}
          label={copy.label}
          name="golden-search"
          onChange={(event) => { generationRef.current += 1; setQuery(event.currentTarget.value); setState(event.currentTarget.value ? "typing" : "no-query"); }}
          placeholder={copy.placeholder}
          ref={searchRef}
          value={query}
        />
        <Button type="submit">{copy.submit}</Button>
        <div className={styles.mobileFilterAction}>
          <Button onClick={() => setSheetOpen(true)} variant="secondary">{copy.filter}</Button>
        </div>
      </form>

      {(state === "typing" || state === "suggestions") && query ? (
        <section aria-label={copy.suggestion} className={styles.suggestions}>
          <p className={styles.eyebrow}>{copy.suggestion}</p>
          <button onClick={() => { setQuery("North Grain Oat Drink"); armedRef.current = true; setState("results-loading"); }} type="button">North Grain Oat Drink — review fixture</button>
          <button onClick={() => { setQuery("5901234123457"); armedRef.current = true; setState("results-loading"); }} type="button">5901234123457</button>
        </section>
      ) : null}

      <div className={styles.searchLayout}>
        <aside className={styles.filterRail} aria-label={copy.filter}>
          <SearchFilters copy={copy} includePartial={includePartial} includeUnknown={includeUnknown} onPartial={setIncludePartial} onUnknown={setIncludeUnknown} prefix="rail" />
          <Button fullWidth onClick={applyFilters}>{copy.apply}</Button>
          <Button fullWidth onClick={() => { setIncludePartial(false); setIncludeUnknown(false); setState("results"); }} variant="quiet">{copy.clear}</Button>
        </aside>

        <section aria-label={copy.results} className={styles.searchResults}>
          <div className={styles.filterSummary}>
            <GoldenGlyph name="compare" />
            <div><strong>{copy.summary}</strong><p>{includePartial || includeUnknown ? [includePartial ? copy.withPartial : "", includeUnknown ? copy.withUnknown : ""].filter(Boolean).join(" · ") : copy.allRecords}</p></div>
          </div>
          <div aria-atomic="true" aria-live="polite" className={styles.resultCount} role="status">
            {["results", "filters-active", "degraded", "offline-cache"].includes(state) ? copy.results : ""}
          </div>
          {state === "degraded" ? <PageState description={copy.degradedDetail} headingLevel={2} status="degraded" title={copy.degraded} /> : null}
          {statePage ? (
            <PageState
              description={statePage.detail}
              headingLevel={2}
              primaryAction={statePage.status === "error" ? <Button onClick={() => setState("results")}>{common.retry}</Button> : undefined}
              status={statePage.status}
              title={statePage.title}
            />
          ) : (
            <div className={styles.resultList}>
              {products.map((product) => (
                <article className={styles.resultRow} key={product.id}>
                  <div className={styles.resultIdentity}><span className={styles.productThumb}><GoldenGlyph name="source" /></span><div><h2>{product.name}</h2><p>{product.brand} · {product.ean}</p></div></div>
                  <div><span className={styles.eyebrow}>{common.decision}</span><strong>{copy.resultDecision}</strong><small>{product.mainReason}</small></div>
                  <div><span className={styles.eyebrow}>{common.dataConfidence}</span><strong>{product.dataConfidence}</strong><small>{product.confidenceReason}</small></div>
                  <div className={styles.resultScore}>{product.decisionScore === null ? <><strong>{copy.scoreUnavailable}</strong><small>{common.unknownInvariant}</small></> : <><strong>{product.decisionScore}<small>/100</small></strong><small>{common.scoreDerived}</small></>}</div>
                  <a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/product?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=${product.decisionScore === null ? "unknown" : product.availability === "partial" ? "partial" : "available"}`}>{copy.open}</a>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <Sheet
        closeLabel={copy.close}
        footer={<><Button onClick={applyFilters}>{copy.apply}</Button><Button onClick={() => { setIncludePartial(false); setIncludeUnknown(false); }} variant="quiet">{copy.clear}</Button></>}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        title={copy.filter}
      >
        <SearchFilters copy={copy} includePartial={includePartial} includeUnknown={includeUnknown} onPartial={setIncludePartial} onUnknown={setIncludeUnknown} prefix="sheet" />
      </Sheet>
    </div>
  );
}
