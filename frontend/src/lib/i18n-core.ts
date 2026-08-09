// ─── Server-safe translation core ──────────────────────────────────────────

import de from "@/../messages/de.json";
import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import {
  humanizeKey,
  interpolateMessage,
  resolveMessage,
  type InterpolationParams,
  type MessageDictionary,
} from "@/lib/i18n-format";
import type { SupportedLanguage } from "@/stores/language-store";

export { humanizeKey } from "@/lib/i18n-format";
export type { InterpolationParams } from "@/lib/i18n-format";

const DICTIONARIES: Record<string, MessageDictionary> = {
  en: en as MessageDictionary,
  pl: pl as MessageDictionary,
  de: de as MessageDictionary,
};

export function translate(
  language: SupportedLanguage,
  key: string,
  params?: InterpolationParams,
): string {
  const dictionary = DICTIONARIES[language];
  const value = dictionary ? resolveMessage(dictionary, key) : undefined;
  if (value !== undefined) return interpolateMessage(value, params);

  if (language !== "en") {
    const fallback = resolveMessage(DICTIONARIES.en, key);
    if (fallback !== undefined) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] Missing ${language} translation: "${key}" — using English fallback`);
      }
      return interpolateMessage(fallback, params);
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[i18n] Missing translation key: "${key}"`);
  }
  return humanizeKey(key);
}
