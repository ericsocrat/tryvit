"use client";

// ─── Client translation hook and request-language context ──────────────────

import { useClientMessages } from "@/components/i18n/ClientMessagesProvider";

export { humanizeKey } from "@/lib/i18n-format";
export type { InterpolationParams } from "@/lib/i18n-format";
export { InitialLanguageContext } from "@/lib/initial-language-context";

export function useTranslation() {
  const { t, language } = useClientMessages();
  return { t, language };
}
