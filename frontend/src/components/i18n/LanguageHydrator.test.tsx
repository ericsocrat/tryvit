import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSetLanguage = vi.fn();
let mockLoaded = false;

vi.mock("@/stores/language-store", () => ({
  useLanguageStore: (
    selector: (state: { setLanguage: typeof mockSetLanguage; loaded: boolean }) => unknown,
  ) => selector({ setLanguage: mockSetLanguage, loaded: mockLoaded }),
}));

vi.mock("@/lib/constants", () => ({
  COUNTRY_DEFAULT_LANGUAGES: { PL: "pl", DE: "de" },
}));

import { LanguageHydrator } from "@/components/i18n/LanguageHydrator";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("LanguageHydrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoaded = false;
  });

  it("sets language from user preferences", async () => {
    render(<LanguageHydrator preferredLanguage="pl" country="PL" />);

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith("pl");
    });
  });

  it("falls back to country default when preferred_language is unsupported", async () => {
    render(<LanguageHydrator preferredLanguage="fr" country="DE" />);

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith("de");
    });
  });

  it("falls back to English when no preferred_language and no country default", async () => {
    render(<LanguageHydrator preferredLanguage={null} country="US" />);

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith("en");
    });
  });

  it("uses country default when no preferred_language is set", async () => {
    render(<LanguageHydrator preferredLanguage={null} country="PL" />);

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith("pl");
    });
  });

  it("renders nothing (returns null)", () => {
    const { container } = render(<LanguageHydrator preferredLanguage="en" country={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("does not re-set language when already loaded and preferred_language is unsupported", () => {
    mockLoaded = true;
    render(<LanguageHydrator preferredLanguage="fr" country="PL" />);

    // Should not call setLanguage because loaded=true and lang is unsupported
    expect(mockSetLanguage).not.toHaveBeenCalled();
  });

  it("does not replace an already loaded language when no preference is set", () => {
    mockLoaded = true;
    render(<LanguageHydrator preferredLanguage={null} country="DE" />);

    expect(mockSetLanguage).not.toHaveBeenCalled();
  });
});
