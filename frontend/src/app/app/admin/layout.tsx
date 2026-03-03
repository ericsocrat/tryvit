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
    <div>
      {/* Admin header with shield icon + sub-navigation */}
      <div className="mb-6 border-b border-border">
        {/* Title row */}
        <div className="flex items-center gap-2 px-1 pb-3">
          <Icon icon={ShieldCheck} size="lg" className="text-brand" />
          <h1 className="text-lg font-semibold text-foreground">
            {t("nav.admin")}
          </h1>
        </div>

        {/* Tab bar */}
        <nav
          className="flex gap-1"
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
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand text-brand"
                    : "border-transparent text-foreground-secondary hover:border-border hover:text-foreground"
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
