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

/** Map pathname segments to human-readable page names. */
function pageTitle(pathname: string): string {
  const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);
  if (segments.length === 0) return "Home";

  // Authenticated app routes: /app/<section>/...
  if (segments[0] === "app") {
    const section = segments[1];
    if (!section) return "Dashboard";

    const titles: Record<string, string> = {
      categories: "Categories",
      product: "Product Detail",
      search: "Search",
      compare: "Comparisons",
      lists: "Lists",
      scan: "Scanner",
      settings: "Settings",
      admin: "Admin",
    };

    return titles[section] ?? section.charAt(0).toUpperCase() + section.slice(1);
  }

  // Public routes
  const publicTitles: Record<string, string> = {
    auth: "Sign In",
    onboarding: "Onboarding",
    contact: "Contact",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
  };

  return publicTitles[segments[0]] ?? "Page";
}

export function RouteAnnouncer() {
  const pathname = usePathname();
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
    setAnnouncement(`Navigated to ${pageTitle(pathname)}`);
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
