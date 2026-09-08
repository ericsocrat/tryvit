"use client";

import { Button } from "@/components/common/Button";
import { CompareCheckbox } from "@/components/compare/CompareCheckbox";
import { EvidenceLoading, ProductAllergenSummary } from "@/components/evidence/ProductEvidence";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import { AddToListMenu } from "@/components/product/AddToListMenu";
import { ProductRegisterCard } from "@/components/product/ProductRegisterCard";
import { FilterPanel } from "@/components/search/FilterPanel";
import { SaveSearchDialog } from "@/components/search/SaveSearchDialog";
import { useUserPreferencesQuery } from "@/hooks/use-user-preferences-query";
import { findContext, findHref, findProducts, findQueryKeys, parseFindParams } from "@/lib/evidence/search";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useAvoidStore } from "@/stores/avoid-store";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./search.module.css";

export default function SearchPage() {
  return <Suspense fallback={<EvidenceLoading />}><FindWorkspace /></Suspense>;
}

function FindWorkspace() {
  const params = useSearchParams();
  const parameterString = params.toString();
  const parsed = useMemo(() => parseFindParams(new URLSearchParams(parameterString)), [parameterString]);
  const { request, problems } = parsed;
  const router = useRouter();
  const { t, language } = useTranslation();
  const preferences = useUserPreferencesQuery();
  const avoidedIds = useAvoidStore((state) => state.avoidedIds);
  const [saveOpen, setSaveOpen] = useState(false);
  const hasSelection = request.q.length > 0 || (request.filters.category?.length ?? 0) > 0 || (request.filters.nova_group?.length ?? 0) > 0 || (request.filters.allergen_free?.length ?? 0) > 0;
  const country = request.filters.country ?? preferences.data?.country ?? "";
  const context = preferences.data ? findContext(preferences.data, language, [...avoidedIds]) : null;
  const validContext = country === "PL" || country === "DE";
  const query = useQuery({
    queryKey: findQueryKeys.results(request, context),
    queryFn: async () => {
      const result = await findProducts(createClient(), request, language, country);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    enabled: hasSelection && problems.length === 0 && !!preferences.data && !preferences.error && validContext,
    staleTime: 60_000,
  });
  const panel = params.get("panel");
  const filtersOpen = panel === "categories" || panel === "filters";
  const filterCount = (request.filters.category?.length ?? 0) + (request.filters.nova_group?.length ?? 0) + (request.filters.allergen_free?.length ?? 0);
  const navigateQuery = useCallback((q: string, explicit: boolean) => {
    const retained = new URLSearchParams(parameterString);
    if (q.trim()) retained.set("q", q.trim()); else retained.delete("q");
    retained.delete("page");
    const href = problems.length > 0
      ? `/app/search?${retained.toString()}`
      : findHref({ ...request, q: q.trim(), page: 1 });
    if (explicit) router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }, [parameterString, problems, request, router]);
  const closeFilters = useCallback(() => router.replace(findHref(request), { scroll: false }), [request, router]);

  return <AppPage>
    <AppPageHeader eyebrow={t("nav.find")} title={t("findUi.title")} description={t("findUi.description")} />
    <QueryInput query={request.q} onNavigate={navigateQuery} />
    <div className={styles.toolbar}>
      <Button variant="secondary" icon={<SlidersHorizontal size={18} aria-hidden="true" />} aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => router.replace(findHref(request, "filters"), { scroll: false })} disabled={!preferences.data || !!preferences.error || problems.length > 0}>{t("findUi.filtersButton", { count: filterCount })}</Button>
      <label className={styles.sort}>{t("findUi.sort")}<select disabled={problems.length > 0} value={request.filters.sort_by === "name" ? `name-${request.filters.sort_order ?? "asc"}` : "relevance"} onChange={(event) => {
        const name = event.target.value.startsWith("name");
        router.push(findHref({ ...request, page: 1, filters: { ...request.filters, sort_by: name ? "name" : "relevance", sort_order: event.target.value === "name-desc" ? "desc" : "asc" } }), { scroll: false });
      }}><option value="relevance">{t("findUi.relevance")}</option><option value="name-asc">{t("findUi.nameAscending")}</option><option value="name-desc">{t("findUi.nameDescending")}</option></select></label>
      <Link href="/app/search/saved" className={styles.textLink}>{t("savedSearches.title")}</Link>
      {hasSelection && problems.length === 0 ? <Button variant="ghost" onClick={() => setSaveOpen(true)}>{t("findUi.saveSearch")}</Button> : null}
    </div>
    {problems.length > 0 ? <section className={styles.notice} role="alert"><h2>{t("findUi.unsupportedTitle")}</h2><p>{t("findUi.unsupportedDescription")}</p><Button variant="secondary" onClick={() => router.replace(findHref(request), { scroll: false })}>{t("findUi.recoverFilters")}</Button></section> : null}
    {preferences.isPending ? <p role="status">{t("findUi.loadingPreferences")}</p> : preferences.error || !validContext ? <section className={styles.notice} role="alert"><h2>{t("findUi.preferencesUnavailable")}</h2><p>{t("findUi.preferencesRequired")}</p><Button onClick={() => void preferences.refetch()}>{t("common.retry")}</Button><Link href="/app/settings" className={styles.textLink}>{t("nav.settings")}</Link></section> : <>
      <div className={styles.context}><p>{t("findUi.marketContext", { country })}</p><p>{t("findUi.preferenceContext")} <Link href="/app/settings/nutrition">{t("findUi.reviewPreferences")}</Link></p>
        {(request.filters.allergen_free?.length ?? 0) > 0 || (preferences.data?.avoid_allergens.length ?? 0) > 0 ? <p>{t("findUi.allergenExplanation")}</p> : null}
        <label className={styles.toggle}><input type="checkbox" disabled={problems.length > 0} checked={request.showAvoided} onChange={(event) => router.push(findHref({ ...request, page: 1, showAvoided: event.target.checked }), { scroll: false })} />{t("findUi.includeAvoided")}</label>
      </div>
      {!hasSelection && problems.length === 0 ? <section className={styles.empty}><h2>{t("findUi.startTitle")}</h2><p>{t("findUi.startDescription")}</p><div className={styles.emptyActions}><Link href="/app/scan" className={styles.textLink}>{t("nav.scan")}</Link><Button variant="ghost" onClick={() => router.replace(findHref(request, "categories"), { scroll: false })}>{t("findUi.categories")}</Button></div></section> : null}
      {hasSelection && problems.length === 0 && query.isPending ? <EvidenceLoading /> : null}
      {hasSelection && problems.length === 0 && query.isError ? <section className={styles.notice} role="alert"><h2>{t("findUi.loadFailed")}</h2><p>{t("evidenceUi.retryExplanation")}</p><Button loading={query.isFetching} onClick={() => void query.refetch()}>{t("common.retry")}</Button></section> : null}
      {query.data && hasSelection && problems.length === 0 && !query.isError ? <>
        <p className={styles.resultCount} role="status">{t("findUi.resultCount", { count: query.data.total })}</p>
        {query.data.results.length === 0 ? <section className={styles.empty}><h2>{t(query.data.total > 0 ? "findUi.emptyPage" : "findUi.noEligibleTitle")}</h2><p>{t("findUi.noEligibleDescription")}</p><div className={styles.emptyActions}><Button variant="secondary" onClick={() => router.push(findHref({ ...request, filters: query.data.total > 0 ? request.filters : {}, page: 1 }), { scroll: false })}>{t(query.data.total > 0 ? "findUi.firstPage" : "filters.clearAll")}</Button><Link href="/app/settings/nutrition" className={styles.textLink}>{t("findUi.reviewPreferences")}</Link></div></section> : <ul className={styles.results}>
          {query.data.results.map((product) => <ProductRegisterCard key={product.product_id} productId={product.product_id} name={product.product_name} brand={product.brand} category={product.category} href={`/app/product/${product.product_id}`} imageUrl={product.image?.url} readModel={product}
            meta={<ProductAllergenSummary product={product} compact />}
            actions={<><AddToListMenu productId={product.product_id} /><CompareCheckbox productId={product.product_id} productName={product.product_name} /></>} />)}
        </ul>}
        {query.data.pages > 1 ? <nav className={styles.pagination} aria-label={t("findUi.pagination")}><Button variant="secondary" disabled={request.page <= 1} onClick={() => router.push(findHref({ ...request, page: request.page - 1 }))}>{t("common.prev")}</Button><span>{t("findUi.page", { page: request.page, pages: query.data.pages })}</span><Button variant="secondary" disabled={request.page >= query.data.pages} onClick={() => router.push(findHref({ ...request, page: request.page + 1 }))}>{t("common.next")}</Button></nav> : null}
      </> : null}
    </>}
    {preferences.data && validContext && !preferences.error ? <FilterPanel show={filtersOpen && problems.length === 0} filters={request.filters} country={country} userId={preferences.data.user_id} onClose={closeFilters} onChange={(filters) => router.push(findHref({ ...request, filters, page: 1 }, panel === "categories" ? "categories" : "filters"), { scroll: false })} /> : null}
    {saveOpen ? <SaveSearchDialog query={request.q || null} filters={request.filters} show onClose={() => setSaveOpen(false)} /> : null}
  </AppPage>;
}

function QueryInput({ query, onNavigate }: Readonly<{ query: string; onNavigate: (query: string, explicit: boolean) => void }>) {
  const { t } = useTranslation();
  // This is only an editing buffer. The URL alone owns the executed request.
  const [input, setInput] = useState({ url: query, draft: query });
  if (input.url !== query) setInput({ url: query, draft: query });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (input.draft.trim() === query) return;
    timer.current = setTimeout(() => onNavigate(input.draft, false), 350);
    return () => clearTimeout(timer.current);
  }, [input.draft, onNavigate, query]);
  return <form className={styles.searchForm} role="search" action="/app/search" onSubmit={(event) => { event.preventDefault(); clearTimeout(timer.current); onNavigate(input.draft, true); }}>
    <label htmlFor="find-query" className="sr-only">{t("findUi.queryLabel")}</label>
    <Search size={20} aria-hidden="true" />
    <input id="find-query" name="q" type="search" maxLength={200} value={input.draft} onChange={(event) => setInput({ url: query, draft: event.target.value })} placeholder={t("findUi.queryLabel")} autoComplete="off" />
    <Button type="submit">{t("nav.search")}</Button>
  </form>;
}
