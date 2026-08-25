"use client";

import type { MouseEvent } from "react";

function focusMainContent(event: MouseEvent<HTMLAnchorElement>): void {
  const target = document.getElementById("main-content");
  if (!(target instanceof HTMLElement)) return;

  if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
  requestAnimationFrame(() => target.focus({ preventScroll: true }));
  event.currentTarget.blur();
}

export function SkipLinkControl({ label }: Readonly<{ label: string }>) {
  return (
    <a
      href="#main-content"
      onClick={focusMainContent}
      className="fixed start-2 top-2 z-50 -translate-y-20 rounded-lg border border-strong bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none"
    >
      {label}
    </a>
  );
}
