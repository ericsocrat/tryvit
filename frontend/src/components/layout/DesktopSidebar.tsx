"use client";

import { CountryChip } from "@/components/common/CountryChip";
import { FoldedTryVitIdentity } from "@/components/common/FoldedTryVitIdentity";
import { Icon } from "@/components/common/Icon";
import { useActiveRoute } from "@/hooks/use-active-route";
import { useTranslation } from "@/lib/i18n";
import { useAdminStore } from "@/stores/admin-store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";
import { ThemeToggle } from "./ThemeToggle";
import {
  ADMIN_ITEMS,
  SIDEBAR_SECTIONS,
  type AppNavItem,
} from "./app-navigation";

interface DesktopSidebarProps {
  readonly country?: string | null;
}

export function DesktopSidebar({ country = null }: Readonly<DesktopSidebarProps>) {
  const activeRoute = useActiveRoute();
  const pathname = usePathname();
  const { t } = useTranslation();
  const isAdmin = useAdminStore((state) => state.isAdmin);

  return (
    <nav
      className={styles.sidebar}
      aria-label={t("a11y.sidebarNavigation")}
      data-testid="desktop-sidebar"
    >
      <Link href="/app" className={styles.sidebarBrand} aria-label="TryVit">
        <FoldedTryVitIdentity size={32} />
      </Link>

      <div className={styles.sidebarBody}>
        {SIDEBAR_SECTIONS.map((section) => (
          <section key={section.labelKey} className={styles.navSection}>
            <h2 className={styles.registerLabel}>{t(section.labelKey)}</h2>
            {section.items.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                isActive={activeRoute === item.routeKey}
              />
            ))}
          </section>
        ))}

        {isAdmin ? (
          <section className={styles.navSection} data-testid="sidebar-admin-section">
            <h2 className={styles.registerLabel}>{t("nav.admin")}</h2>
            {ADMIN_ITEMS.map((item) => {
              const isActive =
                activeRoute === "admin" && pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`${styles.sidebarLink} ${
                    isActive ? styles.sidebarLinkActive : ""
                  }`}
                >
                  <Icon icon={item.icon} size="md" />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </section>
        ) : null}
      </div>

      <div className={styles.sidebarUtility}>
        <CountryChip country={country} size="sm" showLabel />
        <ThemeToggle
          label={t("theme.label")}
          lightLabel={t("theme.light")}
          darkLabel={t("theme.dark")}
        />
      </div>
    </nav>
  );
}

function SidebarLink({
  item,
  isActive,
}: Readonly<{
  item: AppNavItem;
  isActive: boolean;
}>) {
  const { t } = useTranslation();

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`${styles.sidebarLink} ${
        isActive ? styles.sidebarLinkActive : ""
      } ${item.prominent ? styles.sidebarLinkProminent : ""}`}
      data-prominent={item.prominent ? "true" : undefined}
    >
      <Icon icon={item.icon} size="md" />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}
