"use client";

// ─── Settings — Nutrition & Diet (Diet, Allergens, Health Profiles) ─────────

import { Button } from "@/components/common/Button";
import { SectionError } from "@/components/common/SectionError";
import { SettingsSkeleton } from "@/components/common/skeletons";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import surface from "@/components/layout/CustomerSurface.module.css";
import { HealthProfileSection } from "@/components/settings/HealthProfileSection";
import { useAnalytics } from "@/hooks/use-analytics";
import { useUserPreferencesQuery } from "@/hooks/use-user-preferences-query";
import { setUserPreferences } from "@/lib/api";
import { ALLERGEN_PRESETS, ALLERGEN_TAGS, DIET_OPTIONS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import { useLanguageStore } from "@/stores/language-store";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function NutritionSettingsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { track } = useAnalytics();
  const { t } = useTranslation();
  const setStoreLanguage = useLanguageStore((s) => s.setLanguage);

  const {
    data: prefs,
    error: preferencesError,
    isPending,
    refetch: refetchPreferences,
  } = useUserPreferencesQuery();

  const [diet, setDiet] = useState("none");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [strictDiet, setStrictDiet] = useState(false);
  const [strictAllergen, setStrictAllergen] = useState(false);
  const [treatMayContain, setTreatMayContain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Populate from fetched prefs — adjust state during render when the
  // upstream query result changes (avoids react-hooks/set-state-in-effect).
  // See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPrefs, setPrevPrefs] = useState(prefs);
  if (prefs !== prevPrefs) {
    setPrevPrefs(prefs);
    if (prefs) {
      setDiet(prefs.diet_preference ?? "none");
      setAllergens(prefs.avoid_allergens ?? []);
      setStrictDiet(prefs.strict_diet);
      setStrictAllergen(prefs.strict_allergen);
      setTreatMayContain(prefs.treat_may_contain_as_unsafe);
    }
  }

  function markDirty() {
    setDirty(true);
  }

  function toggleAllergen(tag: string) {
    setAllergens((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
    markDirty();
  }

  function togglePreset(tags: readonly string[], allSelected: boolean) {
    setAllergens((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        tags.forEach((tag) => newSet.delete(tag));
      } else {
        tags.forEach((tag) => newSet.add(tag));
      }
      return Array.from(newSet);
    });
    markDirty();
  }

  async function handleSave() {
    if (!prefs) {
      showToast({ type: "error", messageKey: "auth.preferencesFailed" });
      return;
    }

    setSaving(true);
    const result = await setUserPreferences(supabase, {
      p_diet_preference: diet,
      // Empty is an intentional clear; omission means preserve.
      p_avoid_allergens: allergens,
      p_strict_diet: strictDiet,
      p_strict_allergen: strictAllergen,
      p_treat_may_contain_as_unsafe: treatMayContain,
    });
    setSaving(false);

    if (!result.ok) {
      showToast({ type: "error", message: result.error.message });
      return;
    }

    // Sync the language store (in case prefs changed upstream)
    setStoreLanguage(
      prefs.preferred_language as Parameters<
        typeof setStoreLanguage
      >[0],
    );

    // Invalidate caches since diet/allergens may have changed
    await queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
    await queryClient.invalidateQueries({ queryKey: ["search"] });
    await queryClient.invalidateQueries({ queryKey: ["category-listing"] });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.categoryOverview,
    });

    setDirty(false);
    track("preferences_updated", {
      diet,
      allergen_count: allergens.length,
    });
    showToast({ type: "success", messageKey: "settings.preferencesSaved" });
  }

  if (isPending) {
    return <SettingsSkeleton />;
  }

  if (!prefs && preferencesError) {
    return (
      <AppPage className={surface.appPage}>
        <Breadcrumbs
          items={[
            { labelKey: "nav.home", href: "/app" },
            { labelKey: "nav.settings", href: "/app/settings" },
            { labelKey: "settings.tabNutrition" },
          ]}
        />
        <AppPageHeader
          eyebrow={t("nav.settings")}
          title={t("settings.tabNutrition")}
        />
        <SectionError
          error={preferencesError}
          label={t("settings.tabNutrition")}
          onRetry={() => void refetchPreferences()}
        />
      </AppPage>
    );
  }

  return (
    <AppPage className={surface.appPage}>
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "nav.settings", href: "/app/settings" },
          { labelKey: "settings.tabNutrition" },
        ]}
      />
      <AppPageHeader eyebrow={t("nav.settings")} title={t("settings.tabNutrition")} />

      {/* Diet */}
      <section className={surface.panel}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("settings.dietPreference")}
        </h2>
        <div className={surface.choiceGrid}>
          {DIET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setDiet(opt.value);
                markDirty();
              }}
              className={`rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                diet === opt.value
                  ? "border-brand bg-brand-subtle font-medium text-brand"
                  : "border text-foreground-secondary hover:border-strong"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        {diet !== "none" && (
          <label className="mt-3 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={strictDiet}
              onChange={(e) => {
                setStrictDiet(e.target.checked);
                markDirty();
              }}
              className="h-4 w-4 rounded border-strong text-brand focus-visible:ring-brand"
            />
            <span className="text-sm text-foreground-secondary">
              {t("settings.strictDiet")}
            </span>
          </label>
        )}
      </section>

      {/* Allergens */}
      <section className={surface.panel}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("settings.allergensToAvoid")}
        </h2>

        {/* Quick presets */}
        <div
          className="mb-3 flex flex-wrap gap-2"
          data-testid="allergen-presets"
        >
          {ALLERGEN_PRESETS.map((preset) => {
            const allSelected = preset.tags.every((tag) =>
              allergens.includes(tag),
            );
            return (
              <button
                key={preset.key}
                onClick={() => togglePreset(preset.tags, allSelected)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  allSelected
                    ? "border-brand bg-brand-subtle text-brand"
                    : "border-dashed border-foreground-muted text-foreground-secondary hover:border-strong"
                }`}
              >
                {t(preset.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {ALLERGEN_TAGS.map((a) => (
            <button
              key={a.tag}
              onClick={() => toggleAllergen(a.tag)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                allergens.includes(a.tag)
                  ? "border-error-border bg-error-bg text-error-text"
                  : "border text-foreground-secondary hover:border-strong"
              }`}
            >
              {t(a.labelKey)}
            </button>
          ))}
        </div>
        {allergens.length > 0 && (
          <div className="mt-3 space-y-2">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={strictAllergen}
                onChange={(e) => {
                  setStrictAllergen(e.target.checked);
                  markDirty();
                }}
                className="h-4 w-4 rounded border-strong text-brand focus-visible:ring-brand"
              />
              <span className="text-sm text-foreground-secondary">
                {t("settings.strictAllergen")}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={treatMayContain}
                onChange={(e) => {
                  setTreatMayContain(e.target.checked);
                  markDirty();
                }}
                className="h-4 w-4 rounded border-strong text-brand focus-visible:ring-brand"
              />
              <span className="text-sm text-foreground-secondary">
                {t("settings.treatMayContain")}
              </span>
            </label>
          </div>
        )}
      </section>

      {/* Health Profiles */}
      <HealthProfileSection />

      {/* Save button — sticky bar at bottom when dirty */}
      {dirty && (
        <div className={surface.stickyActions}>
          <Button
            onClick={handleSave}
            disabled={saving}
            fullWidth
          >
            {saving ? t("common.saving") : t("settings.saveChanges")}
          </Button>
        </div>
      )}
    </AppPage>
  );
}
