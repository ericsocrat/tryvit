import { describe, expect, it } from "vitest";

import { DEFAULT_LANGUAGE, isSupportedLanguage, resolveLocaleFromAcceptLanguage } from "./locale";

describe("resolveLocaleFromAcceptLanguage", () => {
  it.each([
    [null, "en"],
    [undefined, "en"],
    ["", "en"],
    ["   ", "en"],
    ["fr-FR", "en"],
  ])("falls back to English for %s", (header, expected) => {
    expect(resolveLocaleFromAcceptLanguage(header)).toBe(expected);
  });

  it.each([
    ["en", "en"],
    ["pl-PL", "pl"],
    ["DE-de", "de"],
    ["en-US", "en"],
  ])("normalizes the supported language tag %s", (header, expected) => {
    expect(resolveLocaleFromAcceptLanguage(header)).toBe(expected);
  });

  it("selects the supported preference with the highest quality", () => {
    expect(resolveLocaleFromAcceptLanguage("de-DE;q=0.6, pl-PL;q=0.9, en;q=0.7")).toBe("pl");
  });

  it("retains header order when quality values are equal", () => {
    expect(resolveLocaleFromAcceptLanguage("de;q=0.8, pl;q=0.8")).toBe("de");
  });

  it("skips unsupported languages before selecting a supported fallback", () => {
    expect(resolveLocaleFromAcceptLanguage("fr-FR, de-DE;q=0.8")).toBe("de");
  });

  it("excludes q=0 preferences", () => {
    expect(resolveLocaleFromAcceptLanguage("pl;q=0, de;q=0.4")).toBe("de");
  });

  it.each([
    "pl;q=",
    "pl;q=invalid",
    "pl;q=-0.1",
    "pl;q=1.1",
    "pl;q=1e-1",
    "pl;q=0x1",
    "pl;q=.5",
    "pl;q=01",
    "pl;q=0.1234",
    "pl;q=1.001",
    "pl;q=0.8;q=0.7",
    "pl_PL",
  ])("ignores the malformed preference %s", (header) => {
    expect(resolveLocaleFromAcceptLanguage(`${header}, de;q=0.3`)).toBe("de");
  });

  it("uses the wildcard as an English fallback at its declared quality", () => {
    expect(resolveLocaleFromAcceptLanguage("*;q=0.8, pl;q=0.7")).toBe("en");
  });

  it("exports a type guard and stable default", () => {
    expect(DEFAULT_LANGUAGE).toBe("en");
    expect(isSupportedLanguage("pl")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
  });
});
