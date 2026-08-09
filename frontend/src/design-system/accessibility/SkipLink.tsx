"use client";

import type { MouseEvent } from "react";

import { useClientMessages } from "@/components/i18n/ClientMessagesProvider";

function focusMainContent(event: MouseEvent<HTMLAnchorElement>): void {
  const target = document.getElementById("main-content");
  if (!(target instanceof HTMLElement)) return;

  if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
  requestAnimationFrame(() => target.focus({ preventScroll: true }));
  // Preserve native fragment scrolling while moving programmatic focus.
  event.currentTarget.blur();
}

export function SkipLink() {
  const { t } = useClientMessages();

  return (
    <a
      href="#main-content"
      onClick={focusMainContent}
      className="fixed start-2 top-2 z-50 -translate-y-20 rounded-lg border border-strong bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none"
    >
      {t("a11y.skipToContent")}
    </a>
  );
}
