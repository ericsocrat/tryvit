"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { PageState } from "@/design-system/patterns/PageState/PageState";
import { Button } from "@/design-system/primitives/Button/Button";
import { Checkbox, Input } from "@/design-system/primitives/Field";
import { Sheet } from "@/design-system/primitives/Overlay";

import type { GoldenCommonCopy } from "./common-copy";
import { GOLDEN_ASYNC_STATE_DWELL_MS, type GoldenRouteState, type GoldenSearchState } from "./contract";
import { GOLDEN_SEARCH_PRODUCTS, type GoldenProductFixture } from "./fixture";
import type { SearchCopy } from "./search-copy";
import { GoldenGlyph } from "./GoldenGlyph";
import styles from "./golden.module.css";

type SearchState = GoldenSearchState;

function scoreStatusOf(product: GoldenProductFixture): GoldenProductFixture["decisionScoreStatus"] {
  return product.decisionScoreStatus;
}

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
  copy: SearchCopy;
}>) {
  return (
    <fieldset className={styles.filterFields}>
      <legend>{copy.filter}</legend>
      <Checkbox checked={includePartial} id={`${prefix}-partial`} label={copy.partialFilter} onChange={(event) => onPartial(event.currentTarget.checked)} />
      <Checkbox checked={includeUnknown} id={`${prefix}-unknown`} label={copy.unknownFilter} onChange={(event) => onUnknown(event.currentTarget.checked)} />
    </fieldset>
  );
}

export function SearchWorkspace({
  route,
  copy,
  common,
}: Readonly<{
  route: GoldenRouteState;
  copy: SearchCopy;
  common: GoldenCommonCopy;
}>) {
  const initialState = route.state as SearchState;
  const [state, setState] = useState<SearchState>(initialState);
  const [query, setQuery] = useState(initialState === "no-query" ? "" : "oat");
  const [includePartial, setIncludePartial] = useState(true);
  const [includeUnknown, setIncludeUnknown] = useState(initialState !== "filters-active");
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
    }, GOLDEN_ASYNC_STATE_DWELL_MS);
    return () => window.clearTimeout(timeout);
  }, [query, state]);

  const products = useMemo(
    () => GOLDEN_SEARCH_PRODUCTS.filter((product) =>
      (includePartial || product.availability !== "partial") &&
      (includeUnknown || product.decisionScore !== null),
    ),
    [includePartial, includeUnknown],
  );
  const visibleResultCount = route.locale === "pl"
    ? `Wyświetlone rekordy syntetyczne: ${products.length}; bez wyniku: ${products.filter((product) => product.decisionScore === null).length}.`
    : route.locale === "de"
      ? `${products.length} synthetische Datensätze angezeigt; ${products.filter((product) => product.decisionScore === null).length} ohne Wert.`
      : `${products.length} synthetic records shown; ${products.filter((product) => product.decisionScore === null).length} without a score.`;

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
    <div className={styles.searchWorkspace} data-golden-client="search-workspace" data-golden-live-state={state} data-golden-semantic-dwell-ms={state === "results-loading" ? GOLDEN_ASYNC_STATE_DWELL_MS : undefined} ref={rootRef}>
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

      {state === "typing" && query ? (
        <section aria-label={copy.typingTitle} className={styles.typingNotice}>
          <GoldenGlyph name="confidence" />
          <div><strong>{copy.typingTitle}</strong><p>{copy.typingDetail}</p></div>
        </section>
      ) : null}

      {state === "suggestions" && query ? (
        <section aria-label={copy.suggestion} className={styles.suggestions}>
          <p className={styles.eyebrow}>{copy.suggestion}</p>
          <button onClick={() => { setQuery(copy.suggestionProduct); armedRef.current = true; setState("results-loading"); }} type="button">{copy.suggestionProduct}</button>
          <button onClick={() => { setQuery("5901234123457"); armedRef.current = true; setState("results-loading"); }} type="button">5901234123457</button>
        </section>
      ) : null}

      <div className={styles.searchLayout}>
        <aside className={styles.filterRail} aria-label={copy.filter}>
          <SearchFilters copy={copy} includePartial={includePartial} includeUnknown={includeUnknown} onPartial={setIncludePartial} onUnknown={setIncludeUnknown} prefix="rail" />
          <Button fullWidth onClick={applyFilters}>{copy.apply}</Button>
          <Button fullWidth onClick={() => { setIncludePartial(true); setIncludeUnknown(true); setState("results"); }} variant="quiet">{copy.clear}</Button>
        </aside>

        <section aria-label={copy.results} className={styles.searchResults}>
          <div className={styles.filterSummary}>
            <GoldenGlyph name="compare" />
            <div><strong>{copy.summary}</strong><p>{includePartial && includeUnknown ? copy.allRecords : [includePartial ? copy.withPartial : "", includeUnknown ? copy.withUnknown : ""].filter(Boolean).join(" · ")}</p></div>
          </div>
          <div aria-atomic="true" aria-live="polite" className={styles.resultCount} data-golden-result-count="" role="status">
            {["results", "filters-active", "degraded", "offline-cache"].includes(state) ? visibleResultCount : ""}
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
              {products.map((product) => {
                const record = copy.records[product.id];
                const scoreStatus = scoreStatusOf(product);
                return (
                <article className={styles.resultRow} key={product.id}>
                  <div className={styles.resultIdentity}><span className={styles.productThumb} data-golden-product-record=""><GoldenGlyph label={copy.recordGlyphLabel} name="source" size={32} /></span><div><h2>{record.name}</h2><p>{product.brand} · {product.ean}</p></div></div>
                  <div><span className={styles.eyebrow}>{common.decision}</span><strong>{copy.resultDecision}</strong><small>{record.mainReason}</small></div>
                  <div><span className={styles.eyebrow}>{common.dataConfidence}</span><strong>{record.confidence}</strong><small>{record.confidenceReason}</small></div>
                  <div className={styles.resultScore}>{scoreStatus === "complete" && product.decisionScore !== null ? <><strong>{product.decisionScore}<small>/100</small></strong><small>{common.scoreDerived}</small></> : <><strong>{common.unknown}</strong><small>{common.unknownInvariant}</small>{scoreStatus === "provisional" && product.decisionScore !== null ? <small className={styles.provisionalValue}>{common.provisionalScore}: {product.decisionScore}/100 · {common.incomplete}</small> : null}</>}</div>
                  <a className={styles.secondaryAnchor} href={`/dev/phase5a2/golden/product?locale=${route.locale}&theme=${route.theme}&motion=${route.motion}&state=${product.decisionScore === null ? "unknown" : product.availability === "partial" ? "partial" : "available"}${route.capture ? "&capture=1" : ""}`}>{copy.open}</a>
                </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Sheet
        closeLabel={copy.close}
        footer={<><Button onClick={applyFilters}>{copy.apply}</Button><Button onClick={() => { setIncludePartial(true); setIncludeUnknown(true); }} variant="quiet">{copy.clear}</Button></>}
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        title={copy.filter}
      >
        <SearchFilters copy={copy} includePartial={includePartial} includeUnknown={includeUnknown} onPartial={setIncludePartial} onUnknown={setIncludeUnknown} prefix="sheet" />
      </Sheet>
    </div>
  );
}
