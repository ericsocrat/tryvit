"use client";

// ─── Health Warnings Card ───────────────────────────────────────────────────
// Displays personalized health warnings for a product based on the user's
// active health profile. Only renders when the user has an active profile.

import { getActiveHealthProfile, getProductHealthWarnings } from "@/lib/api";
import { HEALTH_CONDITIONS, WARNING_SEVERITY } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { queryKeys, staleTimes } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import type { HealthWarning, WarningSeverity } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle,
    Ban,
    Check,
    CheckCircle,
    Info,
    Shield,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";

// ─── Severity icon mapping ─────────────────────────────────────────────────

const SEVERITY_ICON: Record<WarningSeverity, LucideIcon> = {
  critical: Ban,
  high: AlertTriangle,
  moderate: Info,
};

/** Sort order for warning severities (lower = more severe). */
const SEVERITY_ORDER: Record<WarningSeverity, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
};

// ─── Condition icon lookup ──────────────────────────────────────────────────

function getConditionIcon(condition: string): string {
  const found = HEALTH_CONDITIONS.find((c) => c.value === condition);
  return found?.icon ?? "";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function HealthWarningsCard({
  productId,
}: Readonly<{ productId: number }>) {
  const supabase = createClient();
  const { t } = useTranslation();

  // Check if user has an active health profile
  const {
    data: profileData,
    error: profileError,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: queryKeys.activeHealthProfile,
    queryFn: async () => {
      const result = await getActiveHealthProfile(supabase);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.healthProfiles,
  });

  // Fetch warnings only when user has an active profile
  const hasProfile =
    profileData?.profile !== null && profileData?.profile !== undefined;

  const {
    data: warningsData,
    error: warningsError,
    isLoading: warningsLoading,
    refetch: refetchWarnings,
  } = useQuery({
    queryKey: queryKeys.healthWarnings(productId),
    queryFn: async () => {
      const result = await getProductHealthWarnings(supabase, productId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.healthWarnings,
    enabled: hasProfile,
  });

  // Loading profile — show skeleton to avoid layout jump
  if (profileLoading) {
    return (
      <div
        className="card"
        data-testid="health-warnings-card"
        role="status"
        aria-busy="true"
        aria-label={t("healthWarnings.loading")}
      >
        <div className="flex items-center gap-2">
          <div className="skeleton h-5 w-5 rounded-full" />
          <div className="skeleton h-4 w-48 rounded" />
        </div>
      </div>
    );
  }

  if (profileError || !profileData) {
    return (
      <HealthWarningsUnavailable
        onRetry={() => {
          void refetchProfile();
        }}
      />
    );
  }

  // No active profile — show a subtle prompt
  if (!hasProfile) {
    return (
      <div
        className="card border bg-surface-subtle"
        data-testid="health-warnings-card"
      >
        <div className="flex items-center gap-2">
          <Shield size={20} aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground-secondary">
              {t("healthWarnings.title")}
            </p>
            <p className="text-xs text-foreground-secondary">
              {
                t("healthWarnings.setupPrompt").split(
                  t("healthWarnings.healthProfile"),
                )[0]
              }
              <Link
                href="/app/settings"
                className="text-brand underline hover:text-brand-hover"
              >
                {t("healthWarnings.healthProfile")}
              </Link>
              {
                t("healthWarnings.setupPrompt").split(
                  t("healthWarnings.healthProfile"),
                )[1]
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading warnings
  if (warningsLoading) {
    return (
      <div
        className="card"
        data-testid="health-warnings-card"
        role="status"
        aria-busy="true"
        aria-label={t("healthWarnings.loading")}
      >
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton mt-2 h-3 w-64 rounded" />
      </div>
    );
  }

  if (warningsError || !warningsData) {
    return (
      <HealthWarningsUnavailable
        onRetry={() => {
          void refetchWarnings();
        }}
      />
    );
  }

  if (warningsData.evaluation_disposition === "not_applicable") {
    return <HealthWarningsNotApplicable />;
  }

  const isCompleteEvaluation =
    warningsData.evaluation_disposition === "evaluated" &&
    warningsData.evidence_completeness.status === "complete";
  const isPartialWarningResult =
    warningsData.evaluation_disposition === "partial" &&
    warningsData.warning_count > 0;

  if (!isCompleteEvaluation && !isPartialWarningResult) {
    return <HealthWarningsEvidenceGap />;
  }

  // No warnings returned only after every applicable check was evaluated.
  if (warningsData.warning_count === 0) {
    return (
      <div
        className="card border-success-border bg-success-bg"
        data-testid="health-warnings-card"
      >
        <div className="flex items-center gap-2">
          <CheckCircle
            size={20}
            className="text-success-text"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-success-text">
              {t("healthWarnings.withinLimits")}
            </p>
            <p className="text-xs text-success-text">
              {t("healthWarnings.noWarningsFor", {
                name: profileData.profile?.profile_name ?? "",
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sort: critical first, then high, then moderate
  const sorted = [...warningsData.warnings].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );

  // Determine overall card severity (use the highest)
  const topSeverity = sorted[0].severity;
  const cardStyle = WARNING_SEVERITY[topSeverity];

  return (
    <div
      className={`card border ${cardStyle.border} ${cardStyle.bg}`}
      data-testid="health-warnings-card"
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={20} aria-hidden="true" />
          <p className={`text-sm font-semibold ${cardStyle.color}`}>
            {t("healthWarnings.warningCount", {
              count: warningsData.warning_count,
            })}
          </p>
        </div>
        <span className="text-xs text-foreground-muted">
          {t("healthWarnings.profile", {
            name: profileData.profile?.profile_name ?? "",
          })}
        </span>
      </div>

      {/* Warning list */}
      <ul className="space-y-1.5">
        {sorted.map((warning) => (
          <WarningRow
            key={`${warning.condition}-${warning.severity}`}
            warning={warning}
          />
        ))}
      </ul>

      {warningsData.evaluation_disposition === "partial" && (
        <p
          className="mt-3 border-t border-warning-border pt-2 text-xs text-warning-text"
          role="status"
        >
          {t("healthWarnings.partialDescription")}
        </p>
      )}
    </div>
  );
}

function HealthWarningsUnavailable({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-xl border border-warning-border bg-warning-bg p-4"
      data-testid="health-warnings-card"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={20}
          className="mt-0.5 shrink-0 text-warning-text"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-warning-text">
            {t("healthWarnings.unavailableTitle")}
          </p>
          <p className="mt-0.5 text-xs text-warning-text">
            {t("healthWarnings.unavailableDescription")}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-warning-text underline underline-offset-2"
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    </div>
  );
}

function HealthWarningsEvidenceGap() {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-xl border border-warning-border bg-warning-bg p-4"
      data-testid="health-warnings-card"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={20}
          className="mt-0.5 shrink-0 text-warning-text"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-warning-text">
            {t("healthWarnings.incompleteTitle")}
          </p>
          <p className="mt-0.5 text-xs text-warning-text">
            {t("healthWarnings.incompleteDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}

function HealthWarningsNotApplicable() {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-xl border bg-surface-subtle p-4"
      data-testid="health-warnings-card"
      role="status"
    >
      <div className="flex items-start gap-2">
        <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground-secondary">
            {t("healthWarnings.notApplicableTitle")}
          </p>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            {t("healthWarnings.notApplicableDescription")}
          </p>
          <Link
            href="/app/settings"
            className="mt-2 inline-block text-xs font-semibold text-brand underline underline-offset-2 hover:text-brand-hover"
          >
            {t("healthWarnings.reviewProfile")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Warning Row ────────────────────────────────────────────────────────────

function WarningRow({ warning }: Readonly<{ warning: HealthWarning }>) {
  const { t } = useTranslation();
  const style = WARNING_SEVERITY[warning.severity];
  const SeverityIcon = SEVERITY_ICON[warning.severity];
  const conditionIcon = getConditionIcon(warning.condition);

  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0" title={t(style.labelKey)}>
        <SeverityIcon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{conditionIcon}</span>
          <span className={`text-xs font-medium ${style.color}`}>
            {warning.message}
          </span>
        </div>
      </div>
    </li>
  );
}

// ─── Compact badge for search/category results ─────────────────────────────

export function HealthWarningBadge({
  productId,
}: Readonly<{ productId: number }>) {
  const supabase = createClient();
  const { t } = useTranslation();

  // Only fetch if user has an active profile
  const { data: profileData, error: profileError } = useQuery({
    queryKey: queryKeys.activeHealthProfile,
    queryFn: async () => {
      const result = await getActiveHealthProfile(supabase);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.healthProfiles,
  });

  const hasProfile =
    profileData?.profile !== null && profileData?.profile !== undefined;

  const { data: warningsData, error: warningsError } = useQuery({
    queryKey: queryKeys.healthWarnings(productId),
    queryFn: async () => {
      const result = await getProductHealthWarnings(supabase, productId);
      if (!result.ok) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: staleTimes.healthWarnings,
    enabled: hasProfile,
  });

  if (profileError || warningsError) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-text"
        title={t("healthWarnings.unavailableTitle")}
        aria-label={t("healthWarnings.unavailableTitle")}
        data-testid="health-warnings-unavailable-badge"
      >
        <AlertTriangle size={12} aria-hidden="true" />
      </span>
    );
  }

  if (warningsData?.evaluation_disposition === "not_applicable") {
    return null;
  }

  const isCompleteEvaluation =
    warningsData?.evaluation_disposition === "evaluated" &&
    warningsData.evidence_completeness.status === "complete";
  const isPartialWarningResult =
    warningsData?.evaluation_disposition === "partial" &&
    warningsData.warning_count > 0;

  if (hasProfile && warningsData && !isCompleteEvaluation && !isPartialWarningResult) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-text"
        title={t("healthWarnings.incompleteTitle")}
        aria-label={t("healthWarnings.incompleteTitle")}
        data-testid="health-warnings-incomplete-badge"
      >
        <AlertTriangle size={12} aria-hidden="true" />
      </span>
    );
  }

  // Don't show anything if no profile or no warnings
  if (!hasProfile || !warningsData || warningsData.warning_count === 0) {
    // Show a green check if profile exists but no warnings
    if (hasProfile && warningsData?.warning_count === 0) {
      return (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs text-success"
          title={t("healthWarnings.noWarnings")}
        >
          <Check size={12} />
        </span>
      );
    }
    return null;
  }

  // Show warning count badge with severity coloring
  const topSeverity = warningsData.warnings.reduce<WarningSeverity>(
    (worst, w) => {
      return SEVERITY_ORDER[w.severity] < SEVERITY_ORDER[worst]
        ? w.severity
        : worst;
    },
    "moderate",
  );

  const style = WARNING_SEVERITY[topSeverity];

  return (
    <span
      className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-xs font-bold ${style.bg} ${style.color}`}
      title={t("healthWarnings.warningCount", {
        count: warningsData.warning_count,
      })}
    >
      {warningsData.warning_count}
    </span>
  );
}
