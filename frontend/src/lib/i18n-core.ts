// ─── Server-safe translation core ──────────────────────────────────────────

import de from "@/../messages/de.json";
import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import { selectPolishForm } from "@/lib/pluralize";
import type { SupportedLanguage } from "@/stores/language-store";

type MessageDictionary = Record<string, unknown>;
export type InterpolationParams = Record<string, string | number>;

const DICTIONARIES: Record<string, MessageDictionary> = {
  en: en as MessageDictionary,
  pl: pl as MessageDictionary,
  de: de as MessageDictionary,
};

function resolve(dict: MessageDictionary, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = dict;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: InterpolationParams): string {
  if (!params) return template;

  let result = template.replaceAll(
    /\{(\w+)\|([^}]+)\}/g,
    (match, key: string, formsString: string) => {
      const count = params[key];
      if (count === undefined) return match;
      const numericCount = Number(count);
      if (Number.isNaN(numericCount)) return match;
      const forms = formsString.split("|");
      if (forms.length === 2) {
        return numericCount === 1 ? forms[0] : forms[1];
      }
      if (forms.length === 3) {
        return selectPolishForm(numericCount, forms[0], forms[1], forms[2]);
      }
      return match;
    },
  );

  result = result.replaceAll(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });

  return result;
}

export function translate(
  language: SupportedLanguage,
  key: string,
  params?: InterpolationParams,
): string {
  const dictionary = DICTIONARIES[language];
  const value = dictionary ? resolve(dictionary, key) : undefined;
  if (value !== undefined) return interpolate(value, params);

  if (language !== "en") {
    const fallback = resolve(DICTIONARIES.en, key);
    if (fallback !== undefined) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] Missing ${language} translation: "${key}" — using English fallback`);
      }
      return interpolate(fallback, params);
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[i18n] Missing translation key: "${key}"`);
  }
  return humanizeKey(key);
}

export function humanizeKey(key: string): string {
  const segments = key.split(".");
  const genericSuffixes = new Set(["title", "description", "label", "placeholder", "name"]);
  let raw = segments.at(-1) ?? key;
  if (genericSuffixes.has(raw) && segments.length >= 2) {
    raw = segments.at(-2) ?? raw;
  }
  return raw.replaceAll(/[-_]/g, " ").replaceAll(/\b\w/g, (character) => character.toUpperCase());
}
