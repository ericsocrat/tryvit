import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import de from "@/../messages/de.json";
import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import { ClientMessagesProvider } from "@/components/i18n/ClientMessagesProvider";
import { useLanguageStore } from "@/stores/language-store";

import { LanguageSynchronizer } from "./LanguageSynchronizer";

const TEST_DICTIONARIES = { en, pl, de } as const;

function renderSynchronizer(initialLanguage: "en" | "pl" | "de") {
  return render(
    <ClientMessagesProvider
      initialMessages={{
        language: initialLanguage,
        active: TEST_DICTIONARIES[initialLanguage],
        englishFallback: initialLanguage === "en" ? undefined : TEST_DICTIONARIES.en,
      }}
    >
      <LanguageSynchronizer initialLanguage={initialLanguage} />
    </ClientMessagesProvider>,
  );
}

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
    renderSynchronizer("pl");

    expect(useLanguageStore.getState()).toMatchObject({
      language: "pl",
      loaded: false,
    });
    expect(document.documentElement.lang).toBe("pl");
  });

  it("keeps html lang synchronized with later authenticated store changes", async () => {
    renderSynchronizer("en");

    useLanguageStore.getState().setLanguage("de");

    expect(useLanguageStore.getState().loaded).toBe(true);
    await waitFor(() => expect(document.documentElement.lang).toBe("de"));
  });

  it("updates the client state when the server language prop changes", async () => {
    const view = render(
      <ClientMessagesProvider initialMessages={{ language: "en", active: en }}>
        <LanguageSynchronizer initialLanguage="en" />
      </ClientMessagesProvider>,
    );

    view.rerender(
      <ClientMessagesProvider initialMessages={{ language: "en", active: en }}>
        <LanguageSynchronizer initialLanguage="pl" />
      </ClientMessagesProvider>,
    );

    expect(useLanguageStore.getState().language).toBe("pl");
    await waitFor(() => expect(document.documentElement.lang).toBe("pl"));
  });

  it("removes the store subscription when unmounted", () => {
    const view = renderSynchronizer("pl");
    view.unmount();

    useLanguageStore.getState().setLanguage("de");

    expect(document.documentElement.lang).toBe("pl");
  });
});
