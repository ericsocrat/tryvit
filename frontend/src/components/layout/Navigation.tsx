"use client";

import { Icon } from "@/components/common/Icon";
import { useActiveRoute } from "@/hooks/use-active-route";
import { useLists } from "@/hooks/use-lists";
import { useNoncriticalAppQueriesEnabled } from "@/hooks/use-noncritical-app-queries";
import { useTranslation } from "@/lib/i18n";
import { useCompareStore } from "@/stores/compare-store";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { lazy, Suspense, useCallback, useState } from "react";
import styles from "./AppShell.module.css";
import { MOBILE_PRIMARY_ITEMS, MORE_ROUTE_KEYS } from "./app-navigation";

const MoreDrawer = lazy(() =>
  import("@/components/layout/MoreDrawer").then((module) => ({
    default: module.MoreDrawer,
  })),
);

export function Navigation() {
  const activeRoute = useActiveRoute();
  const { t } = useTranslation();
  const noncriticalQueriesEnabled = useNoncriticalAppQueriesEnabled();
  const { data: lists } = useLists(noncriticalQueriesEnabled);
  const compareCount = useCompareStore((state) => state.count());
  const [moreOpen, setMoreOpen] = useState(false);

  const openMore = useCallback(() => setMoreOpen(true), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  const listCount = lists?.lists.length ?? 0;
  const listBadgeText = listCount > 99 ? "99+" : String(listCount);
  const compareBadgeText = compareCount > 9 ? "9+" : String(compareCount);
  const isMoreActive = MORE_ROUTE_KEYS.has(activeRoute);

  return (
    <>
      <nav
        className={styles.bottomNav}
        aria-label={t("a11y.mainNavigation")}
        data-testid="main-navigation"
      >
        <div className={styles.bottomNavInner}>
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const isActive = activeRoute === item.routeKey;
            const badge = item.routeKey === "lists" ? listCount : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={isActive ? "page" : undefined}
                className={`${styles.bottomNavItem} ${
                  isActive ? styles.bottomNavItemActive : ""
                } ${item.prominent ? styles.bottomNavProminent : ""}`}
                data-prominent={item.prominent ? "true" : undefined}
              >
                <span className="relative">
                  <Icon icon={item.icon} size="md" />
                  {badge > 0 ? (
                    <span
                      className={styles.badge}
                      data-testid="nav-badge-lists"
                      aria-hidden="true"
                    >
                      {listBadgeText}
                    </span>
                  ) : null}
                </span>
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={openMore}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={`${styles.bottomNavItem} ${
              isMoreActive ? styles.bottomNavItemActive : ""
            }`}
            data-active={isMoreActive ? "true" : "false"}
          >
            <span className="relative">
              <Icon icon={MoreHorizontal} size="md" />
              {compareCount > 0 ? (
                <span
                  className={styles.badge}
                  data-testid="nav-badge-compare"
                  aria-hidden="true"
                >
                  {compareBadgeText}
                </span>
              ) : null}
            </span>
            <span>{t("nav.more")}</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <Suspense fallback={null}>
          <MoreDrawer open onClose={closeMore} />
        </Suspense>
      ) : null}
    </>
  );
}
