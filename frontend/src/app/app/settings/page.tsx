"use client";

// ─── Settings — Profile & Preferences (Country, Language, Theme) ────────────

import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SectionError } from "@/components/common/SectionError";
import { SettingsSkeleton } from "@/components/common/skeletons";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import surface from "@/components/layout/CustomerSurface.module.css";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { useClientMessages } from "@/components/i18n/ClientMessagesProvider";
import { useAnalytics } from "@/hooks/use-analytics";
import { useUserPreferencesQuery } from "@/hooks/use-user-preferences-query";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { setUserPreferences } from "@/lib/api";
import { COUNTRIES, COUNTRY_DEFAULT_LANGUAGES, getLanguagesForCountry } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";
import { useLanguageStore, type SupportedLanguage } from "@/stores/language-store";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

export default function ProfileSettingsPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { track } = useAnalytics();
  const { t } = useTranslation();
  const { activateLanguage, prepareLanguage } = useClientMessages();
  const setStoreLanguage = useLanguageStore((s) => s.setLanguage);

  const {
    data: prefs,
    error: preferencesError,
    isPending,
    refetch: refetchPreferences,
  } = useUserPreferencesQuery();

  // React Query can provide cache-hot data on the first render. Seed the form
  // from that value so controls never begin from guessed defaults.
  const [country, setCountry] = useState(() => prefs?.country ?? "");
  const [language, setLanguage] = useState<SupportedLanguage>(
    () => (prefs?.preferred_language ?? "en") as SupportedLanguage,
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { showConfirmDialog, confirmNavigation, cancelNavigation } = useUnsavedChanges(dirty);

  // Populate from fetched prefs — adjust state during render when the
  // upstream query result changes (avoids react-hooks/set-state-in-effect).
  // See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevPrefs, setPrevPrefs] = useState(prefs);
  if (prefs !== prevPrefs) {
    setPrevPrefs(prefs);
    if (prefs) {
      setCountry(prefs.country ?? "");
      setLanguage((prefs.preferred_language ?? "en") as SupportedLanguage);
    }
  }

  function markDirty() {
    setDirty(true);
  }

  // Warn on tab close / reload when form has unsaved changes
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    },
    [dirty],
  );

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleBeforeUnload]);

  async function handleSave() {
    if (!prefs) {
      showToast({ type: "error", messageKey: "auth.preferencesFailed" });
      return;
    }

    setSaving(true);

    const prepared = await prepareLanguage(language);
    if (!prepared) {
      setSaving(false);
      showToast({ type: "error", messageKey: "common.error" });
      return;
    }

    const result = await setUserPreferences(supabase, {
      p_country: country,
      p_preferred_language: language,
    });
    if (!result.ok) {
      setSaving(false);
      showToast({ type: "error", message: result.error.message });
      return;
    }

    // The target is cache-hot, so this changes content, <html lang>, and the
    // toast translator atomically without showing an unpersisted preview.
    const languageActivated = await activateLanguage(language);
    if (!languageActivated) {
      setSaving(false);
      showToast({ type: "error", messageKey: "common.error" });
      return;
    }

    setStoreLanguage(language);

    // Invalidate caches since country/language may have changed
    await queryClient.invalidateQueries({ queryKey: queryKeys.preferences });
    await queryClient.invalidateQueries({ queryKey: ["search"] });
    await queryClient.invalidateQueries({ queryKey: ["category-listing"] });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.categoryOverview,
    });

    setDirty(false);
    setSaving(false);
    track("preferences_updated", { country, language });
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
            { labelKey: "settings.tabProfile" },
          ]}
        />
        <AppPageHeader
          eyebrow={t("nav.settings")}
          title={t("settings.tabProfile")}
        />
        <SectionError
          error={preferencesError}
          label={t("settings.tabProfile")}
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
          { labelKey: "settings.tabProfile" },
        ]}
      />
      <AppPageHeader eyebrow={t("nav.settings")} title={t("settings.tabProfile")} />

      {/* Country */}
      <section className={surface.panel}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("settings.country")}
        </h2>
        <div className={surface.choiceGrid}>
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                setCountry(c.code);
                // Auto-switch language to new country's default
                const newDefault = (COUNTRY_DEFAULT_LANGUAGES[c.code] ?? "en") as SupportedLanguage;
                setLanguage(newDefault);
                markDirty();
              }}
              className={[surface.choice, country === c.code ? surface.choiceActive : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="text-2xl">{c.flag}</span>
              <p className="mt-1 text-sm font-medium">{c.native}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Language — filtered by selected country (native + English) */}
      <section className={surface.panel}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("settings.language")}
        </h2>
        <div className={surface.choiceGrid}>
          {getLanguagesForCountry(country).map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code as SupportedLanguage);
                markDirty();
              }}
              className={[surface.choice, language === lang.code ? surface.choiceActive : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <p className="text-sm font-medium">{lang.native}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Theme */}
      <section className={surface.panel}>
        <h2 className="mb-3 text-sm font-semibold text-foreground-secondary lg:text-base">
          {t("settings.theme")}
        </h2>
        <ThemeToggle />
      </section>

      {/* Save button — sticky bar at bottom when dirty */}
      {dirty && (
        <div className={surface.stickyActions}>
          <p className="mb-2 text-center text-xs font-medium text-warning">
            {t("settings.unsavedIndicator")}
          </p>
          <Button onClick={handleSave} disabled={saving} fullWidth>
            {saving ? t("common.saving") : t("settings.saveChanges")}
          </Button>
        </div>
      )}

      {/* Discard changes confirmation dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        title={t("settings.unsavedTitle")}
        description={t("settings.unsavedDescription")}
        confirmLabel={t("settings.unsavedDiscard")}
        variant="danger"
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </AppPage>
  );
}
