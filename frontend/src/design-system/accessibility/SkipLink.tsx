"use client";

import { useClientMessages } from "@/components/i18n/ClientMessagesProvider";
import { SkipLinkControl } from "@/design-system/accessibility/SkipLinkControl.client";

export function SkipLink() {
  const { t } = useClientMessages();
  return <SkipLinkControl label={t("a11y.skipToContent")} />;
}
