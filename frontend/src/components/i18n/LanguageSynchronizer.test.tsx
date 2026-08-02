import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useLanguageStore } from "@/stores/language-store";

import { LanguageSynchronizer } from "./LanguageSynchronizer";

describe("LanguageSynchronizer", () => {
  beforeEach(() => {
    useLanguageStore.getState().reset();
    document.documentElement.lang = "en";
  });

  afterEach(() => {
    cleanup();
    useLanguageStore.getState().reset();
    document.documentElement.lang = "en";
  });

  it("hydrates the store and document from the server language", () => {
    render(<LanguageSynchronizer initialLanguage="pl" />);

    expect(useLanguageStore.getState()).toMatchObject({
      language: "pl",
      loaded: false,
    });
    expect(document.documentElement.lang).toBe("pl");
  });

  it("keeps html lang synchronized with later authenticated store changes", () => {
    render(<LanguageSynchronizer initialLanguage="en" />);

    useLanguageStore.getState().setLanguage("de");

    expect(useLanguageStore.getState().loaded).toBe(true);
    expect(document.documentElement.lang).toBe("de");
  });

  it("updates the client state when the server language prop changes", () => {
    const view = render(<LanguageSynchronizer initialLanguage="en" />);

    view.rerender(<LanguageSynchronizer initialLanguage="pl" />);

    expect(useLanguageStore.getState().language).toBe("pl");
    expect(document.documentElement.lang).toBe("pl");
  });

  it("removes the store subscription when unmounted", () => {
    const view = render(<LanguageSynchronizer initialLanguage="pl" />);
    view.unmount();

    useLanguageStore.getState().setLanguage("de");

    expect(document.documentElement.lang).toBe("pl");
  });
});
