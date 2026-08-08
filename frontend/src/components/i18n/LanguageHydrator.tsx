"use client";

// ─── LanguageHydrator ───────────────────────────────────────────────────────
// Invisible component that runs in the app layout to hydrate the Zustand
// language store from the preferences already resolved by the server layout.
// This avoids repeating api_get_user_preferences in the browser while the
// dashboard's critical request is loading.
//
// Country-language binding: if the user has no explicit preferred_language,
// fall back to their country's default language (e.g. PL → "pl", DE → "de").

import { useEffect } from "react";
import { COUNTRY_DEFAULT_LANGUAGES } from "@/lib/constants";
import { useLanguageStore, type SupportedLanguage } from "@/stores/language-store";

const SUPPORTED = new Set<SupportedLanguage>(["en", "pl", "de"]);

interface LanguageHydratorProps {
  preferredLanguage: string | null;
  country: string | null;
}

export function LanguageHydrator({ preferredLanguage, country }: Readonly<LanguageHydratorProps>) {
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const loaded = useLanguageStore((s) => s.loaded);

  useEffect(() => {
    if (preferredLanguage) {
      const lang = preferredLanguage as SupportedLanguage;
      if (SUPPORTED.has(lang)) {
        setLanguage(lang);
      } else if (!loaded) {
        // Invalid language — fall back to country default or English
        const countryDefault = country
          ? (COUNTRY_DEFAULT_LANGUAGES[country] as SupportedLanguage | undefined)
          : undefined;
        setLanguage(countryDefault ?? "en");
      }
    } else if (!loaded) {
      // No preferred_language set — use country default or English
      const countryDefault = country
        ? (COUNTRY_DEFAULT_LANGUAGES[country] as SupportedLanguage | undefined)
        : undefined;
      setLanguage(countryDefault ?? "en");
    }
  }, [preferredLanguage, country, setLanguage, loaded]);

  return null; // Render-invisible
}
