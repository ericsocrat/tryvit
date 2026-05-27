"use client";

// ─── Admin Layout — sub-navigation tabs for admin pages ──────────────────────
// Renders a horizontal tab bar linking to Submissions, Metrics, and Monitoring.
// Shown on all /app/admin/* pages. Access gated by middleware (ADMIN_EMAILS).
//
// Issue #567 — Add admin links to desktop navigation

import { Icon } from "@/components/common/Icon";
import { useTranslation } from "@/lib/i18n";
import {
  Activity,
  FileText,
  Gauge,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ── Tab definitions ──────────────────────────────────────────────────────── */

interface AdminTab {
  readonly href: string;
  readonly labelKey: string;
  readonly icon: LucideIcon;
}

const ADMIN_TABS: readonly AdminTab[] = [
  {
    href: "/app/admin/submissions",
    labelKey: "nav.adminSubmissions",
    icon: FileText,
  },
  {
    href: "/app/admin/metrics",
    labelKey: "nav.adminMetrics",
    icon: Gauge,
  },
  {
    href: "/app/admin/monitoring",
    labelKey: "nav.adminMonitoring",
    icon: Activity,
  },
] as const;

/* ── Component ────────────────────────────────────────────────────────────── */

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      {/* Admin header with shield icon + sub-navigation */}
      <div className="rounded-2xl border border-border/70 bg-surface/95 p-3 shadow-sm sm:p-4">
        {/* Title row */}
        <div className="flex items-center gap-2 px-1 pb-3">
          <Icon icon={ShieldCheck} size="lg" className="text-brand" />
          <h1 className="text-lg font-semibold text-foreground">
            {t("nav.admin")}
          </h1>
        </div>

        {/* Tab bar */}
        <nav
          className="flex gap-1 rounded-xl bg-surface-subtle/70 p-1"
          aria-label={t("nav.admin")}
        >
          {ADMIN_TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.href);
            const label = t(tab.labelKey);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface text-brand shadow-sm"
                    : "text-foreground-secondary hover:bg-surface hover:text-foreground"
                }`}
              >
                <Icon icon={tab.icon} size="sm" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
