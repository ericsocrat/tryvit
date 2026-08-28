"use client";

// ─── Enhanced Search page — autocomplete, multi-faceted filters, pagination ─

import { AllergenChips } from "@/components/common/AllergenChips";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { LiveRegion } from "@/components/common/LiveRegion";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { NovaBadge } from "@/components/common/NovaBadge";
import { NutriScoreBadge } from "@/components/common/NutriScoreBadge";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { SearchResultsSkeleton } from "@/components/common/skeletons";
import { CompareCheckbox } from "@/components/compare/CompareCheckbox";
import {
  AppPage,
  AppPageHeader,
  AppSectionHeader,
} from "@/components/layout/AppPage";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AddToListMenu } from "@/components/product/AddToListMenu";
import { AvoidBadge } from "@/components/product/AvoidBadge";
import { HealthWarningBadge } from "@/components/product/HealthWarningsCard";
import { ProductRegisterCard } from "@/components/product/ProductRegisterCard";
import { ActiveFilterChips } from "@/components/search/ActiveFilterChips";
import { DidYouMean } from "@/components/search/DidYouMean";
import { FilterPanel } from "@/components/search/FilterPanel";
import { SaveSearchDialog } from "@/components/search/SaveSearchDialog";
import { SearchAutocomplete } from "@/components/search/SearchAutocomplete";
import { useAnalytics } from "@/hooks/use-analytics";
import { useProductAllergenWarnings } from "@/hooks/use-product-allergens";
import type { AllergenWarning } from "@/lib/allergen-matching";
import { searchProducts } from "@/lib/api";
import { eventBus } from "@/lib/events";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { addRecentSearch, getRecentSearches } from "@/lib/recent-searches";
import { createClient } from "@/lib/supabase/client";
import type { FormSubmitEvent, SearchFilters, SearchResult } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ClipboardList,
    LayoutGrid,
    LayoutList,
    Save,
    SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./search.module.css";

/* ── Debounce hook for instant search ─────────────────────────────────────── */

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const AVOID_TOGGLE_KEY = "tryvit:show-avoided";
const VIEW_MODE_KEY = "tryvit:search-view";
const PAGE_SIZE = 20;
const DIACRITIC_MARKS = /\p{M}/gu;

type ViewMode = "grid" | "list";

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(DIACRITIC_MARKS, "")
    .toLowerCase();
}

/**
 * The API exposes a composite relevance value but not a match-reason enum.
 * Disclose a broader relevance match only when the backend returned positive
 * relevance and the submitted phrase is absent from every visible identity
 * field. This does not reinterpret or change backend ranking.
 */
function isBroaderRelevanceMatch(
  product: SearchResult,
  submittedQuery: string,
): boolean {
  const needle = normalizeSearchText(submittedQuery.trim());
  if (!needle || !Number.isFinite(product.relevance) || product.relevance <= 0) {
    return false;
  }

  return ![
    product.product_name,
    product.product_name_en,
    product.product_name_display,
    product.brand,
    product.category,
    product.category_display,
  ].some((value) => normalizeSearchText(value).includes(needle));
}

/* ── localStorage helpers ─────────────────────────────────────────────────── */

function getShowAvoided(): boolean {
  if (globalThis.localStorage === undefined) return false;
  return globalThis.localStorage.getItem(AVOID_TOGGLE_KEY) === "true";
}

function setShowAvoidedStorage(val: boolean) {
  if (globalThis.localStorage === undefined) return;
  globalThis.localStorage.setItem(AVOID_TOGGLE_KEY, String(val));
}

function getViewMode(): ViewMode {
  if (globalThis.localStorage === undefined) return "grid";
  const val = globalThis.localStorage.getItem(VIEW_MODE_KEY);
  // Migrate legacy values
  if (val === "compact" || val === "list") return "list";
  return "grid";
}

function setViewModeStorage(val: ViewMode) {
  if (globalThis.localStorage === undefined) return;
  globalThis.localStorage.setItem(VIEW_MODE_KEY, val);
}

/* ── Page component ───────────────────────────────────────────────────────── */

export default function SearchPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteKeyDownRef = useRef<
    ((e: React.KeyboardEvent) => void) | null
  >(null);

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [page, setPage] = useState(1);
  const [showAvoided, setShowAvoided] = useState(getShowAvoided);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [autocompleteActiveId, setAutocompleteActiveId] = useState<
    string | undefined
  >(undefined);
  const [recentSearches, setRecentSearches] =
    useState<string[]>(getRecentSearches);
  const [viewMode, setViewMode] = useState<ViewMode>(getViewMode);

  // Debounced query for instant as-you-type search (300ms delay)
  const debouncedQuery = useDebounce(query, 300);

  // The active search query (submitted or debounced)
  const activeQuery = submittedQuery || undefined;

  // Auto-trigger search as the user types (instant search) — render-phase
  // tracker (#1063): adjust submittedQuery during render when debouncedQuery
  // or filters change.
  const submitKey = `${debouncedQuery}|${JSON.stringify(filters)}`;
  const [prevSubmitKey, setPrevSubmitKey] = useState(submitKey);
  if (submitKey !== prevSubmitKey) {
    setPrevSubmitKey(submitKey);
    const trimmed = debouncedQuery.trim();
    if (trimmed.length >= 2) {
      setSubmittedQuery(trimmed);
    } else if (trimmed.length === 0 && !hasActiveFilters(filters)) {
      setSubmittedQuery("");
    }
  }

  // Reset page when filters or query change — render-phase tracker (#1063).
  const pageResetKey = `${submittedQuery}|${JSON.stringify(filters)}`;
  const [prevPageResetKey, setPrevPageResetKey] = useState(pageResetKey);
  if (pageResetKey !== prevPageResetKey) {
    setPrevPageResetKey(pageResetKey);
    setPage(1);
  }

  // Search query
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.search(submittedQuery, filters, page),
    queryFn: async () => {
      const result = await searchProducts(supabase, {
        p_query: activeQuery,
        p_filters: filters,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_show_avoided: showAvoided,
      });
      if (!result.ok) throw new Error(result.error.message);
      // Save successful text search
      if (activeQuery && activeQuery.length >= 2) {
        addRecentSearch(activeQuery);
        setRecentSearches(getRecentSearches());
      }
      return result.data;
    },
    enabled:
      (activeQuery !== undefined && activeQuery.length >= 1) ||
      hasActiveFilters(filters),
    staleTime: staleTimes.search,
  });

  // Batch-fetch allergen data for current page of results (#128)
  const allergenState = useProductAllergenWarnings(
    data?.results.map((p) => p.product_id) ?? [],
  );
  const allergenMap = allergenState.warnings;

  const { track } = useAnalytics();

  function handleSubmit(e: FormSubmitEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length >= 1) {
      setSubmittedQuery(q);
      setShowAutocomplete(false);
      track("search_performed", {
        query: q,
        has_filters: hasActiveFilters(filters),
      });
      void eventBus.emit({ type: "product.searched", payload: { query: q } });
    } else if (hasActiveFilters(filters)) {
      // Allow empty query with filters (browse mode)
      setSubmittedQuery("");
      setShowAutocomplete(false);
      track("search_performed", { query: "", has_filters: true });
    }
  }

  function handleAvoidToggle() {
    const next = !showAvoided;
    setShowAvoided(next);
    setShowAvoidedStorage(next);
    // Invalidate current search to re-fetch with new avoid setting
    queryClient.invalidateQueries({ queryKey: ["search"] });
  }

  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.search(submittedQuery, filters, page),
    });
  }, [queryClient, submittedQuery, filters, page]);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.search(submittedQuery, filters, page),
    });
  }, [queryClient, submittedQuery, filters, page]);

  function selectRecent(q: string) {
    setQuery(q);
    setSubmittedQuery(q);
  }

  function handleFiltersChange(newFilters: SearchFilters) {
    setFilters(newFilters);
    track("filter_applied", { filters: newFilters });
    if (newFilters.allergen_free?.length) {
      void eventBus.emit({
        type: "filter.allergen_applied",
        payload: { allergenTags: newFilters.allergen_free },
      });
    }
    // If browse mode with filters, trigger search
    if (!submittedQuery && hasActiveFilters(newFilters)) {
      setSubmittedQuery("");
    }
  }

  const isSearchActive =
    (activeQuery !== undefined && activeQuery.length >= 1) ||
    hasActiveFilters(filters);

  const resultsClassName =
    viewMode === "grid"
      ? `${styles.results} ${styles.gridResults} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3`
      : `${styles.results} ${styles.listResults} space-y-2`;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <AppPage className={styles.page}>
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "nav.search" },
        ]}
      />
      <AppPageHeader
        eyebrow={t("nav.search")}
        title={t("search.emptyState")}
        description={t("search.emptyStateDescription")}
        register={
          data ? (
            <>
              <span>{t("common.productFrom", { country: data.country })}</span>
              <span>{t("search.result", { count: data.total })}</span>
              <span>{t("trust.evidence.scoreProvisionalLabel")}</span>
            </>
          ) : undefined
        }
      />
      <div className={styles.workspace}>
        {/* Filter sidebar (desktop) */}
        <FilterPanel
          filters={filters}
          onChange={handleFiltersChange}
          show={showFilters}
          onClose={() => setShowFilters(false)}
        />

        {/* Main content */}
        <div className={styles.content}>
          {/* Search input */}
          <form
            onSubmit={handleSubmit}
            role="search"
            aria-label={t("a11y.searchProducts")}
            className={styles.searchForm}
          >
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowAutocomplete(true);
                }}
                onFocus={() => setShowAutocomplete(true)}
                onKeyDown={(e) => autocompleteKeyDownRef.current?.(e)}
                placeholder={t("search.placeholder")}
                aria-label={t("a11y.searchProducts")}
                role="combobox"
                aria-expanded={showAutocomplete}
                aria-controls="search-autocomplete-listbox"
                aria-autocomplete="list"
                aria-activedescendant={
                  showAutocomplete ? autocompleteActiveId : undefined
                }
                className="input-field pl-10 pr-10"
                autoFocus
              />
              <svg
                className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {isFetching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
              {!isFetching && query.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSubmittedQuery("");
                    setShowAutocomplete(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-secondary"
                  aria-label={t("search.clearSearch")}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}

              {/* Autocomplete dropdown */}
              <SearchAutocomplete
                query={query}
                onSelect={() => setShowAutocomplete(false)}
                onQuerySubmit={(q) => {
                  setSubmittedQuery(q);
                  setShowAutocomplete(false);
                }}
                onQueryChange={setQuery}
                show={showAutocomplete}
                onClose={() => setShowAutocomplete(false)}
                onInputKeyDown={(handler) => {
                  autocompleteKeyDownRef.current = handler;
                }}
                onActiveIdChange={setAutocompleteActiveId}
              />
            </div>

            {/* Action row: search button, filter toggle, avoid toggle, save */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {/* Primary actions: search + filter (always first row) */}
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={query.trim().length < 1 && !hasActiveFilters(filters)}
                >
                  {t("search.searchButton")}
                </Button>

                {/* Mobile filter toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters(true)}
                  className="touch-target flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-surface-muted lg:hidden"
                >
                  <SlidersHorizontal
                    size={14}
                    aria-hidden="true"
                    className="inline"
                  />{" "}
                  {t("search.filters")}
                  {hasActiveFilters(filters) && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-xxs font-bold text-white">
                      {countActiveFilters(filters)}
                    </span>
                  )}
                </button>
              </div>

              {/* Secondary controls: avoid, view mode, save/saved (wrap as group) */}
              <div className="flex flex-1 items-center gap-2">
                {/* Avoid toggle */}
                <button
                  type="button"
                  onClick={handleAvoidToggle}
                  className="touch-target flex items-center gap-1.5 text-xs text-foreground-secondary hover:text-foreground"
                  title={
                    showAvoided
                      ? t("search.avoidedShown")
                      : t("search.avoidedDemoted")
                  }
                >
                  <span
                    className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                      showAvoided ? "bg-brand" : "bg-surface-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-surface transition-transform ${
                        showAvoided ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </span>{" "}
                  <span className="hidden xs:inline">{t("search.showAvoided")}</span>
                </button>

                {/* View mode toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const next: ViewMode = viewMode === "grid" ? "list" : "grid";
                    setViewMode(next);
                    setViewModeStorage(next);
                  }}
                  className="touch-target flex items-center gap-1.5 text-xs text-foreground-secondary hover:text-foreground"
                  aria-label={t("search.toggleViewMode")}
                  title={t("search.toggleViewMode")}
                >
                  {viewMode === "list" ? (
                    <LayoutGrid size={14} aria-hidden="true" className="inline" />
                  ) : (
                    <LayoutList size={14} aria-hidden="true" className="inline" />
                  )}
                  <span className="hidden xs:inline">
                    {viewMode === "list"
                      ? t("search.gridView")
                      : t("search.listView")}
                  </span>
                </button>

                {/* Right-aligned group: save + saved searches */}
                <span className="ml-auto flex items-center gap-2">
                  {/* Save search */}
                  {isSearchActive && (
                    <button
                      type="button"
                      onClick={() => setShowSaveDialog(true)}
                      className="touch-target text-xs text-foreground-muted hover:text-brand"
                      title={t("search.saveSearch")}
                    >
                      <Save size={14} aria-hidden="true" className="inline" />{" "}
                      <span className="hidden xs:inline">
                        {t("search.saveSearch")}
                      </span>
                    </button>
                  )}

                  {/* Saved searches link */}
                  <Link
                    href="/app/search/saved"
                    className="touch-target text-xs text-foreground-muted hover:text-brand"
                    title={t("search.savedSearches")}
                  >
                    <ClipboardList
                      size={14}
                      aria-hidden="true"
                      className="inline"
                    />{" "}
                    <span className="hidden xs:inline">{t("search.saved")}</span>
                  </Link>
                </span>
              </div>
            </div>
          </form>

          {/* Active filter chips */}
          <ActiveFilterChips filters={filters} onChange={handleFiltersChange} />

          {/* Recent searches — shown when no active search */}
          {!isSearchActive && recentSearches.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
                {t("search.recentSearches")}
              </p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((q) => (
                  <button
                    key={q}
                    onClick={() => selectRecent(q)}
                    className="touch-target rounded-full border border-border px-3 py-1.5 text-sm text-foreground-secondary transition-colors hover:border-foreground-muted hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state — no search or filters active */}
          {!isSearchActive && recentSearches.length === 0 && (
            <div className="space-y-6">
              {/* Popular search suggestions */}
              <div className="text-center">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  {t("search.trySearching")}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {t("search.popularTerms")
                    .split(",")
                    .slice(0, 6)
                    .map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => selectRecent(term.trim())}
                        className="touch-target rounded-full border border-border px-3 py-1.5 text-sm text-foreground-secondary transition-colors hover:border-brand hover:text-brand"
                      >
                        {term.trim()}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoading && isSearchActive && <SearchResultsSkeleton />}

          {/* Error state */}
          {error && (
            <EmptyState
              variant="error"
              titleKey="search.searchFailed"
              action={{ labelKey: "common.retry", onClick: handleRetry }}
            />
          )}

          {/* Results */}
          {data && (
            <>
              <LiveRegion
                message={t("a11y.searchResultsStatus", { count: data.total })}
              />
              <AppSectionHeader
                label={t("common.productFrom", { country: data.country })}
                title={`${t("search.result", { count: data.total })}${
                  data.query ? ` ${t("search.resultsFor", { query: data.query })}` : ""
                }`}
                meta={
                  data.pages > 1
                    ? t("common.pageOf", { page: data.page, pages: data.pages })
                    : undefined
                }
              />
              {filters.sort_by && filters.sort_by !== "relevance" ? (
                <p className={styles.sortIndicator} data-testid="sort-indicator">
                  {t("search.sortedBy", {
                    field: {
                      name: t("filters.name"),
                      unhealthiness: t("filters.healthScore"),
                      nutri_score: t("filters.nutriScore"),
                      calories: t("filters.calories"),
                    }[filters.sort_by] ?? filters.sort_by,
                    direction: filters.sort_order === "desc" ? "↓" : "↑",
                  })}
                </p>
              ) : null}

              {allergenState.enabled && allergenState.isLoading && (
                <output
                  className="block rounded-lg bg-surface-subtle px-3 py-2 text-xs text-foreground-secondary"
                  aria-live="polite"
                  aria-busy="true"
                >
                  {t("trust.evidence.allergenCheckLoading")}
                </output>
              )}

              {allergenState.enabled && allergenState.error && (
                <div
                  className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-text"
                  role="alert"
                >
                  {t("trust.evidence.allergenCheckUnavailable")} {" "}
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-2"
                    onClick={allergenState.refetch}
                  >
                    {t("common.retry")}
                  </button>
                </div>
              )}

              {data.results.length === 0 ? (
                <div className="space-y-4" data-testid="zero-results">
                  <EmptyStateIllustration
                    type="no-results"
                    titleKey={
                      data.query
                        ? "search.noMatchSearch"
                        : "search.noMatchFilters"
                    }
                    descriptionKey="search.adjustFilters"
                    action={
                      hasActiveFilters(filters)
                        ? {
                            labelKey: "search.clearAllFilters",
                            onClick: () => setFilters({}),
                          }
                        : undefined
                    }
                  />

                  {/* "Did you mean?" fuzzy suggestions (#62) */}
                  {data.query && (
                    <DidYouMean
                      query={data.query}
                      onSuggestionClick={(suggestion) => {
                        setQuery(suggestion);
                        setSubmittedQuery(suggestion);
                      }}
                    />
                  )}

                  {/* Helpful tips for zero-results (#62) */}
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="mb-2 text-sm font-medium text-foreground-secondary">
                      {t("search.noResultsSuggestions")}
                    </p>
                    <ul className="space-y-1.5 text-sm text-foreground-muted">
                      {hasActiveFilters(filters) && (
                        <li>• {t("search.tryFewerFilters")}</li>
                      )}
                      <li>• {t("search.checkSpelling")}</li>
                      <li>
                        •{" "}
                        <Link
                          href="/app/categories"
                          className="text-brand hover:text-brand-hover hover:underline"
                        >
                          {t("search.browseCategories")}
                        </Link>
                      </li>
                      <li>
                        •{" "}
                        <Link
                          href="/app/scan"
                          className="text-brand hover:text-brand-hover hover:underline"
                        >
                          {t("search.scanBarcode")}
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <>
                  <ul
                    className={resultsClassName}
                    data-testid="results-container"
                  >
                    {data.results.map((product) => (
                      <ProductRow
                        key={product.product_id}
                        product={product}
                        viewMode={viewMode}
                        submittedQuery={submittedQuery}
                        allergenWarnings={allergenMap[product.product_id] ?? []}
                      />
                    ))}
                  </ul>

                  {/* Pagination */}
                  {data.pages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="touch-target rounded-lg border border-border px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t("common.prev")}
                      </button>
                      {generatePageNumbers(data.page, data.pages).map((p, i) =>
                        p === null ? (
                          <span
                            key={`ellipsis-${i}`}
                            className="px-1 text-foreground-muted"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPage(p)}
                            className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                              p === page
                                ? "bg-brand text-white"
                                : "text-foreground-secondary hover:bg-surface-muted"
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPage((p) => Math.min(data.pages, p + 1))
                        }
                        disabled={page >= data.pages}
                        className="touch-target rounded-lg border border-border px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t("common.next")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Save search dialog */}
          <SaveSearchDialog
            query={submittedQuery || null}
            filters={filters}
            show={showSaveDialog}
            onClose={() => setShowSaveDialog(false)}
          />
        </div>
      </div>
      </AppPage>
    </PullToRefresh>
  );
}

function ProductRow({
  product,
  viewMode = "list",
  allergenWarnings = [],
  submittedQuery,
}: Readonly<{
  product: SearchResult;
  viewMode?: ViewMode;
  allergenWarnings?: AllergenWarning[];
  submittedQuery: string;
}>) {
  const { t } = useTranslation();
  const name = product.product_name_display ?? product.product_name;
  const broaderMatch = isBroaderRelevanceMatch(product, submittedQuery);
  const warnings = [
    product.high_sugar ? t("product.highSugar") : null,
    product.high_salt ? t("product.highSalt") : null,
    product.high_sat_fat ? t("product.highSatFat") : null,
    product.high_additive_load ? t("product.manyAdditives") : null,
  ].filter((warning): warning is string => warning !== null);

  return (
    <ProductRegisterCard
      productId={product.product_id}
      href={`/app/product/${product.product_id}`}
      name={name}
      brand={product.brand}
      category={product.category_display ?? product.category}
      categorySlug={product.category}
      imageUrl={product.image_thumb_url}
      score={product.unhealthiness_score}
      scoreBand={product.score_band}
      variant={viewMode}
      muted={product.is_avoided}
      detail={
        product.calories === null
          ? t("trust.evidence.nutritionUnavailable")
          : `${Math.round(product.calories)} kcal`
      }
      meta={
        <>
          {broaderMatch ? (
            <span
              className={styles.relatedMatch}
              data-testid="broader-relevance-match"
              aria-label={t("trust.searchRelevance.ariaLabel", {
                reason: t("search.relatedTextMatch"),
              })}
            >
              ≈ {t("search.relatedTextMatch")}
            </span>
          ) : null}
          {warnings.map((warning) => (
            <span className={styles.warning} key={warning}>
              {warning}
            </span>
          ))}
          <AllergenChips warnings={allergenWarnings} />
        </>
      }
      badges={
        <>
          <NutriScoreBadge grade={product.nutri_score} size="sm" />
          {product.nova_group ? (
            <NovaBadge group={Number(product.nova_group)} size="sm" />
          ) : null}
        </>
      }
      actions={
        <>
          <HealthWarningBadge productId={product.product_id} />
          <AvoidBadge productId={product.product_id} />
          <AddToListMenu productId={product.product_id} compact />
          <CompareCheckbox productId={product.product_id} productName={name} />
        </>
      }
    />
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function hasActiveFilters(f: SearchFilters): boolean {
  return (
    (f.category?.length ?? 0) > 0 ||
    (f.nutri_score?.length ?? 0) > 0 ||
    (f.nova_group?.length ?? 0) > 0 ||
    (f.allergen_free?.length ?? 0) > 0 ||
    f.max_unhealthiness !== undefined
  );
}

function countActiveFilters(f: SearchFilters): number {
  let count = 0;
  count += f.category?.length ?? 0;
  count += f.nutri_score?.length ?? 0;
  count += f.nova_group?.length ?? 0;
  count += f.allergen_free?.length ?? 0;
  if (f.max_unhealthiness !== undefined) count++;
  return count;
}

function generatePageNumbers(
  current: number,
  total: number,
): (number | null)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | null)[] = [1];
  if (current > 3) pages.push(null);
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    pages.push(i);
  }
  if (current < total - 2) pages.push(null);
  pages.push(total);
  return pages;
}
