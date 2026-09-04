"use client";

// ─── Scan result views — error, not-found, looking-up, found states ─────────

import { Button, ButtonLink } from "@/components/common/Button";
import { EmptyStateIllustration } from "@/components/common/EmptyStateIllustration";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import surface from "@/components/layout/CustomerSurface.module.css";
import { ScanMissSubmitCTA } from "@/components/scan/ScanMissSubmitCTA";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getCountryFlag, getCountryName } from "@/lib/constants";
import { gs1CountryHint } from "@/lib/gs1";
import { useTranslation } from "@/lib/i18n";
import type {
    RecordScanFoundResponse,
    RecordScanNotFoundResponse,
} from "@/lib/types";
import {
    AlertTriangle,
    CheckCircle,
    ClipboardList,
    Info,
    RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

// ─── Shared animation wrapper ───────────────────────────────────────────────

export function FadeSlideIn({
  children,
  delay = 0,
}: Readonly<{ children: React.ReactNode; delay?: number }>) {
  const prefersReduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Defer setState to next frame so the browser paints the initial
    // opacity:0 state before the transition runs. Async callback satisfies
    // react-hooks/set-state-in-effect.
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (prefersReduced) return <>{children}</>;

  return (
    <div
      className="transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transitionDelay: delay ? `${delay}ms` : undefined,
      }}
    >
      {children}
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

interface ScanErrorProps {
  ean: string;
  onRetry: () => void;
  onReset: () => void;
}

export function ScanErrorView({ ean, onRetry, onReset }: ScanErrorProps) {
  const { t } = useTranslation();

  return (
    <FadeSlideIn>
      <div className="space-y-4">
        <div className={[surface.state, surface.errorState, "text-center"].join(" ")}>
          <div className="mb-2 flex justify-center">
            <AlertTriangle
              size={40}
              className="text-error"
              aria-hidden="true"
            />
          </div>
          <p className="text-lg font-semibold text-foreground">
            {t("scan.lookupFailed")}
          </p>
          <p className="mt-1 text-sm text-foreground-secondary">
            {t("scan.lookupError", { ean })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={onRetry}
            className="flex-1"
            icon={<RefreshCw size={16} aria-hidden="true" />}
          >
            {t("common.retry")}
          </Button>
          <Button onClick={onReset} className="flex-1">
            {t("scan.scanAnother")}
          </Button>
        </div>
      </div>
    </FadeSlideIn>
  );
}

// ─── Not-found state ────────────────────────────────────────────────────────

interface ScanNotFoundProps {
  ean: string;
  scanResult: RecordScanNotFoundResponse;
  onReset: () => void;
  country?: string;
}

export function ScanNotFoundView({
  ean,
  scanResult,
  onReset,
  country,
}: ScanNotFoundProps) {
  const { t } = useTranslation();
  const gs1Hint = gs1CountryHint(ean);

  return (
    <FadeSlideIn>
      <div className="mx-auto max-w-md space-y-4">
        <div className={[surface.state, "text-center"].join(" ")}>
          <div className="mb-2 flex animate-fade-in-up justify-center">
            <EmptyStateIllustration type="no-results" titleKey="scan.notFound" />
          </div>
          <p className="mt-1 text-sm text-foreground-secondary">
            {t("scan.notFoundEanPrefix")}
          </p>
          <code className="mt-1 inline-block rounded bg-surface-muted px-2 py-0.5 font-mono text-sm tracking-widest text-foreground">
            {ean}
          </code>
          <p className="mt-1 text-sm text-foreground-secondary">
            {t("scan.notFoundEanSuffix")}
          </p>
          {gs1Hint && (
            <>
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-foreground-secondary dark:bg-gray-800">
                <span aria-hidden="true">{getCountryFlag(gs1Hint.code)}</span>
                {t("scan.gs1Hint", { country: gs1Hint.name })}
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                {t("scan.gs1CoverageNote")}
              </p>
            </>
          )}
        </div>

        <ScanMissSubmitCTA
          ean={ean}
          hasPendingSubmission={scanResult.has_pending_submission}
          country={country}
        />

        <div className="flex gap-2">
          <Button
            onClick={onReset}
            className="flex-1"
          >
            {t("scan.scanAnother")}
          </Button>
          <ButtonLink
            href="/app/scan/history"
            variant="secondary"
            className="flex-1"
            icon={<ClipboardList size={16} aria-hidden="true" />}
          >
            {t("scan.history")}
          </ButtonLink>
        </div>
      </div>
    </FadeSlideIn>
  );
}

// ─── Looking-up state ───────────────────────────────────────────────────────

interface ScanLookingUpProps {
  ean: string;
}

export function ScanLookingUpView({ ean }: ScanLookingUpProps) {
  const { t } = useTranslation();

  return (
    <FadeSlideIn>
      <div className="flex flex-col items-center gap-3 py-12">
        <LoadingSpinner />
        <p className="text-sm text-foreground-secondary">
          {t("scan.lookingUp", { ean })}
        </p>
      </div>
    </FadeSlideIn>
  );
}

// ─── Found state ────────────────────────────────────────────────────────────

interface ScanFoundProps {
  product: RecordScanFoundResponse;
  onViewDetails: () => void;
  onReset: () => void;
}

export function ScanFoundView({
  product,
  onViewDetails,
  onReset,
}: ScanFoundProps) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();

  return (
    <FadeSlideIn>
      <div className="space-y-4">
        <div className={[surface.panel, "text-center"].join(" ")}>
          <div className="mb-3 flex justify-center">
            <CheckCircle
              size={48}
              className={`text-success${
                prefersReduced ? "" : " animate-[bounceIn_0.5s_ease-out]"
              }`}
              aria-hidden="true"
            />
          </div>
        <p className="text-lg font-bold text-foreground">
          {t("scan.productFound")}
        </p>
        <p className="mt-2 text-base font-semibold text-foreground">
          {product.product_name_display ?? product.product_name}
        </p>
        {product.brand && (
          <p className="text-sm text-foreground-secondary">
            {product.brand}
          </p>
        )}
        {product.is_cross_country && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-foreground-secondary dark:bg-gray-800">
            <span aria-hidden="true">{getCountryFlag(product.product_country)}</span>
            {t("scan.crossCountryBadge", { country: getCountryName(product.product_country) })}
          </p>
        )}
        <p
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-3 py-1 text-sm text-foreground-secondary"
          role="status"
        >
          <Info size={14} aria-hidden="true" />
          {t("scan.scoreEvidencePending")}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onViewDetails} className="flex-1">
          {t("scan.viewDetails")}
        </Button>
        <Button
          variant="secondary"
          onClick={onReset}
          className="flex-1"
        >
          {t("scan.scanNext")}
        </Button>
      </div>
    </div>
    </FadeSlideIn>
  );
}
