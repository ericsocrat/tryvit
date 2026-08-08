"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  translateFromMessages,
  type InitialClientMessages,
  type InterpolationParams,
  type MessageDictionary,
} from "@/lib/i18n-format";
import { registerToastTranslator } from "@/lib/toast";
import type { SupportedLanguage } from "@/stores/language-store";

type Translate = (key: string, params?: InterpolationParams) => string;

export interface ClientMessagesContextValue {
  readonly language: SupportedLanguage;
  readonly t: Translate;
  readonly prepareLanguage: (language: SupportedLanguage) => Promise<boolean>;
  readonly activateLanguage: (language: SupportedLanguage) => Promise<boolean>;
}

interface PendingCommit {
  readonly language: SupportedLanguage;
  readonly resolve: (committed: boolean) => void;
}

const ClientMessagesContext = createContext<ClientMessagesContextValue | undefined>(undefined);

export type ClientDictionaryLoader = (language: SupportedLanguage) => Promise<MessageDictionary>;

const dictionaryLoaders: Record<SupportedLanguage, () => Promise<MessageDictionary>> = {
  en: () => import("@/../messages/en.json").then((module) => module.default as MessageDictionary),
  pl: () => import("@/../messages/pl.json").then((module) => module.default as MessageDictionary),
  de: () => import("@/../messages/de.json").then((module) => module.default as MessageDictionary),
};

export const loadClientDictionary: ClientDictionaryLoader = (language) =>
  dictionaryLoaders[language]();

export function ClientMessagesProvider({
  children,
  initialMessages,
  loadMessages = loadClientDictionary,
}: Readonly<{
  children: ReactNode;
  initialMessages: InitialClientMessages;
  loadMessages?: ClientDictionaryLoader;
}>) {
  const [current, setCurrent] = useState(() => initialMessages);
  const dictionaries = useRef(
    new Map<SupportedLanguage, MessageDictionary>([
      [initialMessages.language, initialMessages.active],
      ...(initialMessages.englishFallback
        ? ([["en", initialMessages.englishFallback]] as const)
        : []),
    ]),
  );
  const activationSequence = useRef(0);
  const committedLanguage = useRef(initialMessages.language);
  const pendingCommit = useRef<PendingCommit | undefined>(undefined);
  const loadingDictionaries = useRef(new Map<SupportedLanguage, Promise<MessageDictionary>>());

  const prepareLanguage = useCallback(
    async (language: SupportedLanguage): Promise<boolean> => {
      if (dictionaries.current.has(language)) return true;

      let loading = loadingDictionaries.current.get(language);
      if (!loading) {
        loading = loadMessages(language);
        loadingDictionaries.current.set(language, loading);
      }

      try {
        const dictionary = await loading;
        dictionaries.current.set(language, dictionary);
        return true;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[i18n] Failed to load ${language} messages`, error);
        }
        return false;
      } finally {
        if (loadingDictionaries.current.get(language) === loading) {
          loadingDictionaries.current.delete(language);
        }
      }
    },
    [loadMessages],
  );

  const activateLanguage = useCallback(
    async (language: SupportedLanguage): Promise<boolean> => {
      const sequence = ++activationSequence.current;
      pendingCommit.current?.resolve(false);
      pendingCommit.current = undefined;

      const prepared = await prepareLanguage(language);
      const dictionary = dictionaries.current.get(language);

      if (!prepared || !dictionary || sequence !== activationSequence.current) {
        return false;
      }

      if (committedLanguage.current === language) {
        // A different language may already be queued. Ensure this latest
        // request is the final state even when React batches both updates.
        setCurrent((previous) =>
          previous.language === language
            ? previous
            : {
                language,
                active: dictionary,
                englishFallback:
                  language === "en"
                    ? undefined
                    : (dictionaries.current.get("en") ?? previous.englishFallback),
              },
        );
        return true;
      }

      return new Promise<boolean>((resolve) => {
        pendingCommit.current = { language, resolve };
        setCurrent((previous) => ({
          language,
          active: dictionary,
          englishFallback:
            language === "en"
              ? undefined
              : (dictionaries.current.get("en") ?? previous.englishFallback),
        }));
      });
    },
    [prepareLanguage],
  );

  const t = useCallback<Translate>(
    (key, params) => translateFromMessages(current.active, current.englishFallback, key, params),
    [current.active, current.englishFallback],
  );

  useLayoutEffect(() => {
    committedLanguage.current = current.language;
    document.documentElement.lang = current.language;
    const unregister = registerToastTranslator(t);
    if (pendingCommit.current?.language === current.language) {
      pendingCommit.current.resolve(true);
      pendingCommit.current = undefined;
    }
    return unregister;
  }, [current.language, t]);

  useEffect(() => {
    return () => {
      pendingCommit.current?.resolve(false);
      pendingCommit.current = undefined;
    };
  }, []);

  const value = useMemo<ClientMessagesContextValue>(
    () => ({
      language: current.language,
      t,
      prepareLanguage,
      activateLanguage,
    }),
    [activateLanguage, current.language, prepareLanguage, t],
  );

  return <ClientMessagesContext.Provider value={value}>{children}</ClientMessagesContext.Provider>;
}

export function useClientMessages(): ClientMessagesContextValue {
  const value = useContext(ClientMessagesContext);
  const testFallback = (
    globalThis as typeof globalThis & {
      __TRYVIT_CLIENT_MESSAGES_TEST_FALLBACK__?: ClientMessagesContextValue;
    }
  ).__TRYVIT_CLIENT_MESSAGES_TEST_FALLBACK__;
  if (!value && process.env.NODE_ENV === "test" && testFallback) {
    return testFallback;
  }
  if (!value) {
    throw new Error("useClientMessages must be used within ClientMessagesProvider");
  }
  return value;
}
