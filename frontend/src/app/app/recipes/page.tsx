"use client";

// ─── Recipes browse — grid of curated recipe cards with filters ─────────────
// Issue #53 — Recipes v0
// Issue #705 — Search, active filter chips, share

import { Button } from "@/components/common/Button";
import { Chip } from "@/components/common/Chip";
import { EmptyState } from "@/components/common/EmptyState";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { RecipeGridSkeleton } from "@/components/common/skeletons";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { RecipeCard } from "@/components/recipes";
import { browseRecipes } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { BrowseRecipesFilters, RecipeCategory, RecipeDifficulty } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";

/* ── Filter options (keys map to i18n) ───────────────────────────────────── */

const CATEGORY_OPTIONS: RecipeCategory[] = [
  "breakfast", "lunch", "dinner", "snack", "dessert", "drink", "salad", "soup",
];

const DIFFICULTY_OPTIONS: RecipeDifficulty[] = ["easy", "medium", "hard"];

/* ── Component ───────────────────────────────────────────────────────────── */

export default function RecipesBrowsePage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [category, setCategory] = useState<RecipeCategory | "">("");
  const [difficulty, setDifficulty] = useState<RecipeDifficulty | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);

  const filters = useMemo<BrowseRecipesFilters>(
    () => ({
      ...(category ? { category } : {}),
      ...(difficulty ? { difficulty } : {}),
    }),
    [category, difficulty],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.recipes(filters as Record<string, unknown>),
    queryFn: async () => {
      const result = await browseRecipes(supabase, filters);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.recipes,
  });

  /* ── Client-side search filtering ──────────────────────────────── */
  const filteredData = useMemo(() => {
    if (!data || !deferredSearch.trim()) return data;
    const q = deferredSearch.toLowerCase().trim();
    return data.filter((recipe) => {
      const title = t(recipe.title_key).toLowerCase();
      const desc = t(recipe.description_key).toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [data, deferredSearch, t]);

  const hasActiveFilters = category !== "" || difficulty !== "";

  const handleRetry = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.recipes(filters as Record<string, unknown>) });
  }, [queryClient, filters]);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.recipes(filters as Record<string, unknown>) });
  }, [queryClient, filters]);

  const handleClearAll = useCallback(() => {
    setCategory("");
    setDifficulty("");
    setSearchQuery("");
  }, []);

  if (isLoading) return <RecipeGridSkeleton />;

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="mb-3 text-sm text-error">{t("recipes.loadFailed")}</p>
        <Button onClick={handleRetry} size="sm">
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div>
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "nav.recipes" },
        ]}
      />

      <h1 className="mb-4 text-xl font-bold text-foreground lg:text-2xl">
        {t("recipes.title")}
      </h1>

      {/* ── Search + Filters ─────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-2" data-testid="recipe-filter">
        <div className="relative w-full sm:w-auto sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-secondary" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("recipes.searchPlaceholder")}
            className="input w-full rounded-lg py-2 pl-9 pr-8 text-sm"
            aria-label={t("recipes.searchPlaceholder")}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-foreground-secondary hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as RecipeCategory | "")}
          className="input rounded-lg px-3 py-2 text-sm"
          aria-label={t("recipes.filterCategory")}
        >
          <option value="">{t("recipes.allCategories")}</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {t(`recipes.category.${c}`)}
            </option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as RecipeDifficulty | "")}
          className="input rounded-lg px-3 py-2 text-sm"
          aria-label={t("recipes.filterDifficulty")}
        >
          <option value="">{t("recipes.allDifficulties")}</option>
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {t(`recipes.difficulty.${d}`)}
            </option>
          ))}
        </select>
      </div>

      {/* ── Active filter chips ──────────────────────────────────── */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="active-filter-chips">
          {category && (
            <Chip
              variant="primary"
              onRemove={() => setCategory("")}
              removeLabel={`Remove ${t(`recipes.category.${category}`)}`}
            >
              {t(`recipes.category.${category}`)}
            </Chip>
          )}
          {difficulty && (
            <Chip
              variant="primary"
              onRemove={() => setDifficulty("")}
              removeLabel={`Remove ${t(`recipes.difficulty.${difficulty}`)}`}
            >
              {t(`recipes.difficulty.${difficulty}`)}
            </Chip>
          )}
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-medium text-brand hover:underline"
          >
            {t("recipes.clearFilters")}
          </button>
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────────── */}
      {filteredData && filteredData.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {filteredData.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <EmptyState
          variant="no-results"
          titleKey="recipes.emptyTitle"
          descriptionKey="recipes.emptyDescription"
        />
      )}
    </div>
    </PullToRefresh>
  );
}
