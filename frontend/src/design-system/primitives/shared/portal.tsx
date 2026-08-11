import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

export interface PortalScopeAttributes {
  readonly "data-design-system": "v2";
  readonly "data-theme"?: "light" | "dark";
  readonly dir?: "ltr" | "rtl";
  readonly lang?: string;
}

function closestAttribute(anchor: Element, attribute: string): string | undefined {
  return anchor.closest<HTMLElement>(`[${attribute}]`)?.getAttribute(attribute) ?? undefined;
}

export function portalScopeAttributes(anchor: Element): PortalScopeAttributes {
  const rawTheme = closestAttribute(anchor, "data-theme");
  const explicitDirection = closestAttribute(anchor, "dir");
  const computedDirection = anchor.ownerDocument.defaultView
    ?.getComputedStyle(anchor).direction;
  const rawDirection = explicitDirection === "ltr" || explicitDirection === "rtl"
    ? explicitDirection
    : computedDirection === "rtl"
      ? "rtl"
      : "ltr";
  const language = closestAttribute(anchor, "lang") ??
    (anchor.ownerDocument.documentElement.lang || undefined);
  return {
    "data-design-system": "v2",
    ...(rawTheme === "light" || rawTheme === "dark" ? { "data-theme": rawTheme } : {}),
    dir: rawDirection,
    ...(language ? { lang: language } : {}),
  };
}

export function resolvePortalHost(anchor: Element): HTMLElement {
  const dialog = anchor.closest<HTMLDialogElement>("dialog[open]");
  if (dialog) {
    return dialog.querySelector<HTMLElement>("[data-ds-overlay-host]") ?? dialog;
  }
  return anchor.closest<HTMLElement>("[data-ds-overlay-host]") ?? anchor.ownerDocument.body;
}

export function ScopedPortal({
  anchor,
  children,
  style,
}: Readonly<{
  anchor: Element | null;
  children: ReactNode;
  style?: CSSProperties;
}>) {
  if (!anchor) return null;
  const attributes = portalScopeAttributes(anchor);
  return createPortal(
    <div
      {...attributes}
      data-ds-portal-root=""
      style={{ display: "contents", ...style }}
    >
      {children}
    </div>,
    resolvePortalHost(anchor),
  );
}
