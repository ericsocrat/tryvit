"use client";

import { Icon } from "@/components/common/Icon";
import { useActiveRoute } from "@/hooks/use-active-route";
import { useTranslation } from "@/lib/i18n";
import { useAdminStore } from "@/stores/admin-store";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./AppShell.module.css";
import { ThemeToggle } from "./ThemeToggle";
import {
  ADMIN_ENTRY_ITEM,
  HEADER_MORE_ITEMS,
  HEADER_PRIMARY_ITEMS,
} from "./app-navigation";

export function DesktopHeaderNav() {
  const activeRoute = useActiveRoute();
  const { t } = useTranslation();
  const isAdmin = useAdminStore((state) => state.isAdmin);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  useEffect(() => {
    if (!dropdownOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDropdown();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDropdown, dropdownOpen]);

  const menuItems = isAdmin
    ? [...HEADER_MORE_ITEMS, ADMIN_ENTRY_ITEM]
    : HEADER_MORE_ITEMS;
  const isDropdownItemActive = menuItems.some(
    (item) => item.routeKey !== null && activeRoute === item.routeKey,
  );

  return (
    <nav
      className={styles.headerNav}
      aria-label={t("a11y.headerNavigation")}
      data-testid="desktop-header-navigation"
    >
      {HEADER_PRIMARY_ITEMS.map((item) => {
        const isActive = activeRoute === item.routeKey;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`${styles.headerLink} ${
              isActive ? styles.headerLinkActive : ""
            }`}
            data-prominent={item.prominent ? "true" : undefined}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}

      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((current) => !current)}
          aria-expanded={dropdownOpen}
          aria-controls="desktop-more-navigation"
          className={`${styles.headerMoreButton} ${
            isDropdownItemActive ? styles.headerMoreActive : ""
          }`}
          data-active={isDropdownItemActive ? "true" : "false"}
        >
          {t("nav.more")}
          <Icon
            icon={ChevronDown}
            size="sm"
            className={`transition-transform motion-reduce:transition-none ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {dropdownOpen ? (
          <div
            className={styles.headerMenu}
            id="desktop-more-navigation"
            data-testid="desktop-more-panel"
          >
            <div>
              {menuItems.map((item) => {
                const isActive = activeRoute === item.routeKey;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={closeDropdown}
                    className={`${styles.headerMenuLink} ${
                      isActive ? styles.headerMenuLinkActive : ""
                    }`}
                  >
                    <Icon icon={item.icon} size="md" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
            <div className={styles.drawerUtility}>
              <ThemeToggle
                label={t("theme.label")}
                lightLabel={t("theme.light")}
                darkLabel={t("theme.dark")}
              />
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
