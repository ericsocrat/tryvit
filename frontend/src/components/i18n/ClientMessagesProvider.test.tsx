import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import de from "@/../messages/de.json";
import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import type { InitialClientMessages, MessageDictionary } from "@/lib/i18n-format";
import { resetRateLimiter, showToast } from "@/lib/toast";
import type { SupportedLanguage } from "@/stores/language-store";
import {
  ClientMessagesProvider,
  useClientMessages,
  type ClientDictionaryLoader,
} from "./ClientMessagesProvider";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const DICTIONARIES = { en, pl, de } as const;

function messages(language: SupportedLanguage): InitialClientMessages {
  return {
    language,
    active: DICTIONARIES[language],
    englishFallback: language === "en" ? undefined : DICTIONARIES.en,
  };
}

function wrapper(initialMessages: InitialClientMessages, loadMessages?: ClientDictionaryLoader) {
  function ClientMessagesTestWrapper({ children }: { children: ReactNode }) {
    return (
      <ClientMessagesProvider initialMessages={initialMessages} loadMessages={loadMessages}>
        {children}
      </ClientMessagesProvider>
    );
  }

  return ClientMessagesTestWrapper;
}

afterEach(() => {
  resetRateLimiter();
  document.documentElement.lang = "en";
  vi.clearAllMocks();
});

describe("ClientMessagesProvider", () => {
  it("fails closed outside the provider when no test fallback is installed", () => {
    const testGlobal = globalThis as typeof globalThis & {
      __TRYVIT_CLIENT_MESSAGES_TEST_FALLBACK__?: unknown;
    };
    const fallback = testGlobal.__TRYVIT_CLIENT_MESSAGES_TEST_FALLBACK__;
    delete testGlobal.__TRYVIT_CLIENT_MESSAGES_TEST_FALLBACK__;

    try {
      expect(() => renderHook(() => useClientMessages())).toThrow(
        "useClientMessages must be used within ClientMessagesProvider",
      );
    } finally {
      testGlobal.__TRYVIT_CLIENT_MESSAGES_TEST_FALLBACK__ = fallback;
    }
  });

  it.each([
    ["en", "Dashboard"],
    ["pl", "Pulpit"],
    ["de", "Einstellungen"],
  ] as const)("renders %s synchronously", (language, expected) => {
    const { result } = renderHook(() => useClientMessages(), {
      wrapper: wrapper(messages(language)),
    });

    expect(result.current.language).toBe(language);
    expect(result.current.t(language === "de" ? "nav.settings" : "nav.home")).toBe(expected);
    expect(document.documentElement.lang).toBe(language);
  });

  it("preserves the English missing-key fallback", () => {
    const { result } = renderHook(() => useClientMessages(), {
      wrapper: wrapper({
        language: "pl",
        active: {},
        englishFallback: en,
      }),
    });

    expect(result.current.t("nav.home")).toBe("Dashboard");
  });

  it("lets the latest language request win when imports resolve out of order", async () => {
    const resolvers = new Map<SupportedLanguage, (dictionary: MessageDictionary) => void>();
    const loadMessages = vi.fn(
      (language: SupportedLanguage) =>
        new Promise<MessageDictionary>((resolve) => {
          resolvers.set(language, resolve);
        }),
    );
    const { result } = renderHook(() => useClientMessages(), {
      wrapper: wrapper(messages("en"), loadMessages),
    });

    let polish: Promise<boolean>;
    let german: Promise<boolean>;
    act(() => {
      polish = result.current.activateLanguage("pl");
      german = result.current.activateLanguage("de");
    });

    await act(async () => {
      resolvers.get("de")?.(de);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.language).toBe("de"));
    await expect(german!).resolves.toBe(true);

    await act(async () => {
      resolvers.get("pl")?.(pl);
      await Promise.resolve();
    });
    await expect(polish!).resolves.toBe(false);

    expect(result.current.language).toBe("de");
    expect(result.current.t("nav.settings")).toBe("Einstellungen");
  });

  it("cancels a queued language when the latest request restores the committed language", async () => {
    const loadMessages = vi.fn(async (language: SupportedLanguage) => DICTIONARIES[language]);
    const { result } = renderHook(() => useClientMessages(), {
      wrapper: wrapper(messages("en"), loadMessages),
    });

    await expect(result.current.prepareLanguage("pl")).resolves.toBe(true);

    let polish!: Promise<boolean>;
    let english!: Promise<boolean>;
    act(() => {
      polish = result.current.activateLanguage("pl");
      english = result.current.activateLanguage("en");
    });

    await expect(polish).resolves.toBe(false);
    await expect(english).resolves.toBe(true);
    await waitFor(() => expect(result.current.language).toBe("en"));
    expect(result.current.t("nav.home")).toBe("Dashboard");
    expect(document.documentElement.lang).toBe("en");
  });

  it("keeps the coherent previous language when a chunk fails to load", async () => {
    const loadMessages = vi.fn(async () => {
      throw new Error("offline cache miss");
    });
    const { result } = renderHook(() => useClientMessages(), {
      wrapper: wrapper(messages("en"), loadMessages),
    });

    let activated = true;
    await act(async () => {
      activated = await result.current.activateLanguage("pl");
    });

    expect(activated).toBe(false);
    expect(result.current.language).toBe("en");
    expect(result.current.t("nav.home")).toBe("Dashboard");
    expect(document.documentElement.lang).toBe("en");
  });

  it("updates document language and toast translations with the committed messages", async () => {
    const { result } = renderHook(() => useClientMessages(), {
      wrapper: wrapper(messages("en"), async (language) => DICTIONARIES[language]),
    });

    let activation!: Promise<boolean>;
    act(() => {
      activation = result.current.activateLanguage("pl");
    });
    await waitFor(() => {
      expect(result.current.language).toBe("pl");
      expect(document.documentElement.lang).toBe("pl");
    });
    await expect(activation).resolves.toBe(true);

    showToast({ type: "success", messageKey: "nav.home" });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Pulpit", expect.any(Object));
  });
});
