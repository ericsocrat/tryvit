"use client";

/**
 * RouteAnnouncer — announces page navigations to screen readers.
 *
 * Renders a visually-hidden aria-live region that updates whenever
 * the Next.js pathname changes, announcing the new page title to
 * assistive technology users.
 */

import { usePathname } from "next/navigation";
import { useState } from "react";

import { useClientMessages } from "@/components/i18n/ClientMessagesProvider";

const APP_SECTION_KEYS = {
  categories: "a11y.routes.categories",
  product: "a11y.routes.product",
  search: "a11y.routes.search",
  compare: "a11y.routes.compare",
  lists: "a11y.routes.lists",
  scan: "a11y.routes.scan",
  settings: "a11y.routes.settings",
  admin: "a11y.routes.admin",
} as const;

const PUBLIC_ROUTE_KEYS = {
  auth: "a11y.routes.signIn",
  onboarding: "a11y.routes.onboarding",
  contact: "a11y.routes.contact",
  privacy: "a11y.routes.privacy",
  terms: "a11y.routes.terms",
} as const;

/** Map pathname segments to human-readable page names. */
function pageTitle(pathname: string, t: (key: string) => string): string {
  const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);
  if (segments.length === 0) return t("a11y.routes.home");

  // Authenticated app routes: /app/<section>/...
  if (segments[0] === "app") {
    const section = segments[1];
    if (!section) return t("a11y.routes.dashboard");

    const key = APP_SECTION_KEYS[section as keyof typeof APP_SECTION_KEYS];
    return t(key ?? "a11y.routes.page");
  }

  // Public routes
  const key = PUBLIC_ROUTE_KEYS[segments[0] as keyof typeof PUBLIC_ROUTE_KEYS];
  return t(key ?? "a11y.routes.page");
}

export function RouteAnnouncer() {
  const pathname = usePathname();
  const { t } = useClientMessages();
  const [announcement, setAnnouncement] = useState("");
  // Track the last announced pathname. Initialised to the current pathname so
  // the very first render produces no announcement (the browser already
  // announces initial page load).
  const [lastPathname, setLastPathname] = useState(pathname);

  // Adjusting state during render — React's recommended pattern for reacting
  // to prop changes without an effect. React schedules an immediate re-render
  // without committing the discarded one. Compatible with React Compiler
  // (no `set-state-in-effect` violation).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setAnnouncement(t("a11y.routeAnnouncement", { page: pageTitle(pathname, t) }));
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
