"use client";

// ─── Bottom navigation for the app shell ────────────────────────────────────
// Issue #67 — replaced Settings with "More" drawer to surface all nav items.

import { Icon } from "@/components/common/Icon";
import { MoreDrawer } from "@/components/layout/MoreDrawer";
import { useActiveRoute, type PrimaryRouteKey } from "@/hooks/use-active-route";
import { useLists } from "@/hooks/use-lists";
import { useTranslation } from "@/lib/i18n";
import { useCompareStore } from "@/stores/compare-store";
import { Camera, ClipboardList, Home, MoreHorizontal, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  routeKey: PrimaryRouteKey;
}

/** Routes that live in the "More" drawer rather than the bottom bar. */
const MORE_ROUTE_KEYS = new Set<PrimaryRouteKey>([
  "compare",
  "categories",
  "watchlist",
  "settings",
  "achievements",
]);

const NAV_ITEMS: NavItem[] = [
  { href: "/app", labelKey: "nav.home", icon: Home, routeKey: "home" },
  {
    href: "/app/search",
    labelKey: "nav.search",
    icon: Search,
    routeKey: "search",
  },
  { href: "/app/scan", labelKey: "nav.scan", icon: Camera, routeKey: "scan" },
  {
    href: "/app/lists",
    labelKey: "nav.lists",
    icon: ClipboardList,
    routeKey: "lists",
  },
];

export function Navigation() {
  const activeRoute = useActiveRoute();
  const { t } = useTranslation();
  const { data: lists } = useLists();
  const compareCount = useCompareStore((s) => s.count());
  const [moreOpen, setMoreOpen] = useState(false);

  const openMore = useCallback(() => setMoreOpen(true), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  // Badge counts keyed by routeKey — only show when count > 0
  const badgeCounts: Partial<Record<NonNullable<PrimaryRouteKey>, number>> = {};
  if (lists && lists.lists.length > 0) {
    badgeCounts.lists = lists.lists.length;
  }

  // Highlight "More" if active route lives in the drawer
  const isMoreActive = MORE_ROUTE_KEYS.has(activeRoute);
  const compareBadgeText = compareCount > 9 ? "9+" : String(compareCount);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:hidden"
        aria-label={t("a11y.mainNavigation")}
        data-testid="main-navigation"
      >
        <div className="mx-auto flex max-w-5xl px-1 pt-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.routeKey;
            const label = t(item.labelKey);
            const badge = item.routeKey ? badgeCounts[item.routeKey] : undefined;
            const badgeText = badge != null ? (badge > 99 ? "99+" : String(badge)) : "";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-12 min-w-16 rounded-xl py-2 landscape:py-1 text-xs transition-colors ${
                  isActive
                    ? "bg-brand-subtle/80 text-brand font-semibold"
                    : "text-foreground-secondary hover:bg-surface-subtle/80 hover:text-foreground"
                }`}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <span
                    className="absolute top-1 h-1 w-6 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                )}
                <span className="relative">
                  <Icon icon={item.icon} size="md" />
                  {badge != null && badge > 0 && (
                    <span
                      className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-xxs font-bold leading-none text-white"
                      data-testid={`nav-badge-${item.routeKey}`}
                    >
                      {badgeText}
                    </span>
                  )}
                </span>{" "}
                <span>{label}</span>
              </Link>
            );
          })}

          {/* More button — opens drawer with secondary nav items */}
          <button
            type="button"
            onClick={openMore}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-12 min-w-16 rounded-xl py-2 landscape:py-1 text-xs transition-colors ${
              isMoreActive
                ? "bg-brand-subtle/80 text-brand font-semibold"
                : "text-foreground-secondary hover:bg-surface-subtle/80 hover:text-foreground"
            }`}
          >
            {isMoreActive && (
              <span className="absolute top-1 h-1 w-6 rounded-full bg-brand" aria-hidden="true" />
            )}
            <span className="relative">
              <Icon icon={MoreHorizontal} size="md" />
              {compareCount > 0 && (
                <span
                  className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-xxs font-bold leading-none text-white"
                  data-testid="nav-badge-compare"
                >
                  {compareBadgeText}
                </span>
              )}
            </span>{" "}
            <span>{t("nav.more")}</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      <MoreDrawer open={moreOpen} onClose={closeMore} />
    </>
  );
}
