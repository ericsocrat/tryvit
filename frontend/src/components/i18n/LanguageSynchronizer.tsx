"use client";

import { useEffect } from "react";

import { useClientMessages } from "@/components/i18n/ClientMessagesProvider";
import { useLanguageStore, type SupportedLanguage } from "@/stores/language-store";

/**
 * Hydrate the client language from the server-resolved request locale without
 * marking authenticated preferences as loaded. Later store updates remain the
 * authority and are mirrored to the document language.
 */
export function LanguageSynchronizer({
  initialLanguage,
}: {
  readonly initialLanguage: SupportedLanguage;
}) {
  const { activateLanguage } = useClientMessages();

  useEffect(() => {
    const synchronize = (language: SupportedLanguage) => {
      void activateLanguage(language);
    };

    const unsubscribe = useLanguageStore.subscribe((state) =>
      synchronize(state.loaded ? state.language : initialLanguage),
    );

    const currentState = useLanguageStore.getState();
    if (!currentState.loaded) {
      useLanguageStore.setState({ language: initialLanguage });
      synchronize(initialLanguage);
    } else {
      synchronize(currentState.language);
    }

    return () => {
      unsubscribe();
    };
  }, [activateLanguage, initialLanguage]);

  return null;
}
