// ─── Country and language configuration ────────────────────────────────────
// Kept deliberately separate from the broader product-domain constants so the
// persistent app shell does not ship allergen, scoring, category, and health
// configuration merely to render a country badge or choose a default locale.

export const COUNTRIES = [
  { code: "DE", name: "Germany", native: "Deutschland", flag: "🇩🇪" },
  { code: "PL", name: "Poland", native: "Polska", flag: "🇵🇱" },
] as const;

export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "de", name: "German", native: "Deutsch" },
] as const;

/**
 * Maps country codes to their default (native) language.
 * Each country offers exactly 2 languages: its native language + English.
 * Kept in sync with country_ref.default_language in the database.
 */
export const COUNTRY_DEFAULT_LANGUAGES: Record<string, string> = {
  PL: "pl",
  DE: "de",
} as const;

/** Get flag emoji for any ISO 3166-1 alpha-2 country code via regional indicators. */
export function getCountryFlag(code: string): string {
  if (!/^[A-Z]{2}$/i.test(code)) return "🌐";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...([...upper].map((character) => 0x1f1e6 + character.charCodeAt(0) - 65)),
  );
}

/** Get English display name for a country code. Falls back to the code itself. */
export function getCountryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

/** Get the available languages for a country: [native, English]. */
export function getLanguagesForCountry(countryCode: string) {
  const nativeLanguage = COUNTRY_DEFAULT_LANGUAGES[countryCode] ?? "en";
  return LANGUAGES.filter(
    (language) => language.code === nativeLanguage || language.code === "en",
  );
}
