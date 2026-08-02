"use client";

// ─── Client translation hook and request-language context ──────────────────

import { InitialLanguageContext } from "@/lib/initial-language-context";
import { translate, type InterpolationParams } from "@/lib/i18n-core";
import { useLanguageStore } from "@/stores/language-store";
import { useCallback, useContext, useMemo } from "react";

export { humanizeKey, translate } from "@/lib/i18n-core";
export { InitialLanguageContext } from "@/lib/initial-language-context";

export function useTranslation() {
  const initialLanguage = useContext(InitialLanguageContext);
  const storedLanguage = useLanguageStore((state) => state.language);
  const loaded = useLanguageStore((state) => state.loaded);
  const language = loaded ? storedLanguage : (initialLanguage ?? storedLanguage);

  const t = useCallback(
    (key: string, params?: InterpolationParams) => translate(language, key, params),
    [language],
  );

  return useMemo(() => ({ t, language }), [t, language]);
}
