"use client";

import { Icon } from "@/components/common/Icon";
import { useActiveRoute } from "@/hooks/use-active-route";
import { useTranslation } from "@/lib/i18n";
import { useAdminStore } from "@/stores/admin-store";
import { X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./AppShell.module.css";
import { ThemeToggle } from "./ThemeToggle";
import {
  ADMIN_ENTRY_ITEM,
  DRAWER_SECTIONS,
  type AppNavItem,
} from "./app-navigation";

interface MoreDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

const SWIPE_DISMISS_THRESHOLD = 80;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MoreDrawer({ open, onClose }: Readonly<MoreDrawerProps>) {
  const activeRoute = useActiveRoute();
  const { t } = useTranslation();
  const isAdmin = useAdminStore((state) => state.isAdmin);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!open) return;

    const dialog = drawerRef.current;
    if (!dialog) return;
    const activeDialog: HTMLDialogElement = dialog;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      // JSDOM and older embedded webviews do not implement showModal().
      dialog.setAttribute("open", "");
    }

    const frame = requestAnimationFrame(() => {
      setAnimating(true);
      activeDialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        activeDialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (typeof dialog.close === "function" && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
      previouslyFocusedRef.current?.focus();
    };
  }, [onClose, open]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartY.current = event.touches[0].clientY;
    touchDeltaY.current = 0;
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const delta = event.touches[0].clientY - touchStartY.current;
    touchDeltaY.current = delta;
    if (delta > 0 && drawerRef.current) {
      drawerRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchDeltaY.current > SWIPE_DISMISS_THRESHOLD) onClose();
    if (drawerRef.current) drawerRef.current.style.transform = "";
  }, [onClose]);

  if (!open) return null;

  const visibleSections = isAdmin
    ? [
        ...DRAWER_SECTIONS,
        { labelKey: "nav.admin", items: [ADMIN_ENTRY_ITEM] },
      ]
    : DRAWER_SECTIONS;

  return (
    <dialog
      ref={drawerRef}
      aria-label={t("a11y.moreNavigation")}
      className={`${styles.drawer} ${animating ? styles.drawerOpen : ""}`}
      data-state={animating ? "open" : "opening"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.drawerHandle} data-testid="drawer-handle" />
      <div className={styles.drawerHeader}>
        <span className={styles.registerLabel}>{t("nav.more")}</span>
        <button
          type="button"
          onClick={onClose}
          className="touch-target rounded-md p-2 text-foreground-secondary transition-colors hover:bg-surface-muted hover:text-foreground motion-reduce:transition-none"
          aria-label={t("common.close")}
        >
          <Icon icon={X} size="md" />
        </button>
      </div>

      <nav aria-label={t("a11y.moreNavigation")}>
        <div className={styles.drawerSections}>
          {visibleSections.map((section) => (
            <section key={section.labelKey} className={styles.drawerSection}>
              <h2 className={styles.registerLabel}>{t(section.labelKey)}</h2>
              <ul>
                {section.items.map((item) => (
                  <DrawerLink
                    key={item.href}
                    item={item}
                    active={activeRoute === item.routeKey}
                    onClose={onClose}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>

      <div className={styles.drawerUtility}>
        <ThemeToggle
          label={t("theme.label")}
          lightLabel={t("theme.light")}
          darkLabel={t("theme.dark")}
        />
      </div>
    </dialog>
  );
}

function DrawerLink({
  item,
  active,
  onClose,
}: Readonly<{
  item: AppNavItem;
  active: boolean;
  onClose: () => void;
}>) {
  const { t } = useTranslation();

  return (
    <li>
      <Link
        href={item.href}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={`${styles.drawerLink} ${
          active ? styles.drawerLinkActive : ""
        }`}
        data-touch-target="true"
      >
        <Icon icon={item.icon} size="md" />
        <span>{t(item.labelKey)}</span>
      </Link>
    </li>
  );
}
