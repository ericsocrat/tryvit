"use client";

import { useTranslation } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOPICS } from "./LearnSidebar";
import styles from "./LearnExperience.module.css";

// ─── Previous / Next topic navigation ──────────────────────────────

/**
 * Bottom navigation for /learn/* topic pages.
 * Shows prev/next topic links for easy sequential browsing (especially on mobile
 * where the sidebar is hidden).
 */
export function LearnTopicNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  const currentIndex = TOPICS.findIndex((tp) => `/learn/${tp.slug}` === pathname);
  if (currentIndex === -1) return null;

  const prev = currentIndex > 0 ? TOPICS[currentIndex - 1] : null;
  const next = currentIndex < TOPICS.length - 1 ? TOPICS[currentIndex + 1] : null;

  return (
    <nav
      aria-label={t("learn.topicNavLabel")}
      className={styles.topicNav}
    >
      {prev ? (
        <Link
          href={`/learn/${prev.slug}`}
          className={styles.topicNavLink}
        >
          <ChevronLeft size={16} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{t(prev.labelKey)}</span>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      {next ? (
        <Link
          href={`/learn/${next.slug}`}
          className={[styles.topicNavLink, styles.nextLink].join(" ")}
        >
          <span className="truncate">{t(next.labelKey)}</span>
          <ChevronRight size={16} className="shrink-0" aria-hidden="true" />
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </nav>
  );
}
