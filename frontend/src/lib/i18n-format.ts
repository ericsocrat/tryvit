import { selectPolishForm } from "@/lib/pluralize";
import type { SupportedLanguage } from "@/stores/language-store";

export type MessageDictionary = Readonly<Record<string, unknown>>;
export type InterpolationParams = Record<string, string | number>;

export interface InitialClientMessages {
  readonly language: SupportedLanguage;
  readonly active: MessageDictionary;
  readonly englishFallback?: MessageDictionary;
}

export function resolveMessage(dictionary: MessageDictionary, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = dictionary;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

export function interpolateMessage(template: string, params?: InterpolationParams): string {
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

export function translateFromMessages(
  primary: MessageDictionary,
  englishFallback: MessageDictionary | undefined,
  key: string,
  params?: InterpolationParams,
): string {
  const value = resolveMessage(primary, key);
  if (value !== undefined) return interpolateMessage(value, params);

  const fallback = englishFallback ? resolveMessage(englishFallback, key) : undefined;
  if (fallback !== undefined) return interpolateMessage(fallback, params);

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
