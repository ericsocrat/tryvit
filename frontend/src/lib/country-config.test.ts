import * as compatibilityExports from "@/lib/constants";
import {
  COUNTRIES,
  COUNTRY_DEFAULT_LANGUAGES,
  getCountryFlag,
  getCountryName,
  getLanguagesForCountry,
  LANGUAGES,
} from "@/lib/country-config";
import { describe, expect, it } from "vitest";

describe("country-config", () => {
  it("preserves the established country and language behavior", () => {
    expect(COUNTRIES.map((country) => country.code)).toEqual(["DE", "PL"]);
    expect(COUNTRY_DEFAULT_LANGUAGES).toEqual({ PL: "pl", DE: "de" });
    expect(getCountryFlag("PL")).toBe("🇵🇱");
    expect(getCountryFlag("invalid")).toBe("🌐");
    expect(getCountryName("DE")).toBe("Germany");
    expect(getCountryName("US")).toBe("US");
    expect(getLanguagesForCountry("PL").map((language) => language.code)).toEqual([
      "en",
      "pl",
    ]);
  });

  it("keeps the original constants module as a reference-identical compatibility facade", () => {
    expect(compatibilityExports.COUNTRIES).toBe(COUNTRIES);
    expect(compatibilityExports.COUNTRY_DEFAULT_LANGUAGES).toBe(COUNTRY_DEFAULT_LANGUAGES);
    expect(compatibilityExports.LANGUAGES).toBe(LANGUAGES);
    expect(compatibilityExports.getCountryFlag).toBe(getCountryFlag);
    expect(compatibilityExports.getCountryName).toBe(getCountryName);
    expect(compatibilityExports.getLanguagesForCountry).toBe(getLanguagesForCountry);
  });
});
