import type { SupportedLanguage } from "@/stores/language-store";

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export const SUPPORTED_LANGUAGES = [
  "en",
  "pl",
  "de",
] as const satisfies readonly SupportedLanguage[];

const SUPPORTED_LANGUAGE_SET = new Set<string>(SUPPORTED_LANGUAGES);

interface LanguagePreference {
  readonly language: SupportedLanguage;
  readonly quality: number;
  readonly position: number;
}

/** Return whether a value is one of TryVit's supported UI languages. */
export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGE_SET.has(value);
}

function parseQuality(parameters: readonly string[]): number | null {
  const qualityParameters = parameters
    .map((parameter) => parameter.trim())
    .filter((parameter) => /^q\s*=/iu.test(parameter));

  if (qualityParameters.length === 0) return 1;
  if (qualityParameters.length > 1) return null;

  const value = qualityParameters[0].replace(/^q\s*=\s*/iu, "");
  // RFC 9110 qvalue: 0–1 with at most three decimal digits; a value beginning
  // with 1 may contain only zeroes after the decimal point.
  if (!/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/u.test(value)) return null;

  const quality = Number(value);
  return quality;
}

function parsePreference(entry: string, position: number): LanguagePreference | null {
  const [rawRange = "", ...parameters] = entry.split(";");
  const range = rawRange.trim().toLowerCase();
  const quality = parseQuality(parameters);

  if (quality === null || quality === 0) return null;

  if (range === "*") {
    return { language: DEFAULT_LANGUAGE, quality, position };
  }

  // Accept ordinary BCP 47 language tags while resolving only their primary
  // language subtag. This covers values such as pl-PL, de-DE and en-US.
  if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/u.test(range)) return null;

  const primaryLanguage = range.split("-", 1)[0];
  if (!isSupportedLanguage(primaryLanguage)) return null;

  return { language: primaryLanguage, quality, position };
}

/**
 * Resolve TryVit's UI language from an HTTP Accept-Language value.
 *
 * Supported regional variants are reduced to EN, PL or DE. Preferences with
 * `q=0` or malformed quality values are ignored, equal-quality preferences
 * retain header order, and English is the deterministic fallback.
 */
export function resolveLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
): SupportedLanguage {
  if (!acceptLanguage?.trim()) return DEFAULT_LANGUAGE;

  let bestPreference: LanguagePreference | null = null;

  for (const [position, entry] of acceptLanguage.split(",").entries()) {
    const preference = parsePreference(entry, position);
    if (!preference) continue;

    if (
      bestPreference === null ||
      preference.quality > bestPreference.quality ||
      (preference.quality === bestPreference.quality &&
        preference.position < bestPreference.position)
    ) {
      bestPreference = preference;
    }
  }

  return bestPreference?.language ?? DEFAULT_LANGUAGE;
}
