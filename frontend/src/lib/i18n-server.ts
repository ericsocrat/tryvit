import de from "@/../messages/de.json";
import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import type { InitialClientMessages, MessageDictionary } from "@/lib/i18n-format";
import type { SupportedLanguage } from "@/stores/language-store";

const SERVER_DICTIONARIES: Record<SupportedLanguage, MessageDictionary> = {
  en: en as MessageDictionary,
  pl: pl as MessageDictionary,
  de: de as MessageDictionary,
};

/**
 * Select only the request locale for the client boundary. Non-English locales
 * also receive English so the established missing-key fallback remains exact.
 */
export function getInitialClientMessages(language: SupportedLanguage): InitialClientMessages {
  return {
    language,
    active: SERVER_DICTIONARIES[language],
    englishFallback: language === "en" ? undefined : SERVER_DICTIONARIES.en,
  };
}
