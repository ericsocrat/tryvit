"use client";

import { useEffect } from "react";

import { useLanguageStore, type SupportedLanguage } from "@/stores/language-store";

function synchronizeDocumentLanguage(language: SupportedLanguage) {
  document.documentElement.lang = language;
}

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
  useEffect(() => {
    const unsubscribe = useLanguageStore.subscribe((state) => {
      synchronizeDocumentLanguage(state.loaded ? state.language : initialLanguage);
    });

    const currentState = useLanguageStore.getState();
    if (!currentState.loaded) {
      useLanguageStore.setState({ language: initialLanguage });
      synchronizeDocumentLanguage(initialLanguage);
    } else {
      synchronizeDocumentLanguage(currentState.language);
    }

    return unsubscribe;
  }, [initialLanguage]);

  return null;
}
