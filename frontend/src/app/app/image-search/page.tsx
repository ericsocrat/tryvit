"use client";

// ─── Image Search page — OCR-only prototype with privacy guardrails ──────────
// Issue #55 — Image Search v0
//
// Flow:
// 1. Privacy consent → 2. Capture/Upload → 3. OCR → 4. Review text → 5. Search
//
// All image processing is client-side. No images are ever uploaded.

import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { AppPage, AppPageHeader } from "@/components/layout/AppPage";
import surface from "@/components/layout/CustomerSurface.module.css";
import { ImageCapture, OCRResults, PrivacyNotice } from "@/components/ocr";
import { useTranslation } from "@/lib/i18n";
import {
    acceptPrivacyConsent,
    buildSearchQuery,
    CONFIDENCE,
    extractText,
    hasPrivacyConsent,
    initOCR,
    releaseImageData,
    terminateOCR,
    type OCRResult,
} from "@/lib/ocr";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── Step union ───────────────────────────────────────────────────────────── */

type Step = "capture" | "processing" | "results";

/* ── Component ────────────────────────────────────────────────────────────── */

export default function ImageSearchPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [step, setStep] = useState<Step>("capture");
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track object URLs for cleanup
  const objectUrlRef = useRef<string | null>(null);

  // Check privacy consent on mount (SSR-safe: hasPrivacyConsent returns true server-side)
  useEffect(() => {
    if (!hasPrivacyConsent()) {
      setShowPrivacy(true);
    }
  }, []);

  // Pre-warm OCR worker after consent
  useEffect(() => {
    if (!showPrivacy && hasPrivacyConsent()) {
      // Pre-warm in background — don't block UI
      initOCR().catch(() => {
        // Non-critical — worker will init on first capture
      });
    }
  }, [showPrivacy]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminateOCR().catch(() => {});
      if (objectUrlRef.current) {
        releaseImageData({ objectUrl: objectUrlRef.current });
        objectUrlRef.current = null;
      }
    };
  }, []);

  const handleAcceptPrivacy = useCallback(() => {
    acceptPrivacyConsent();
    setShowPrivacy(false);
  }, []);

  const handleCapture = useCallback(async (blob: Blob) => {
    setStep("processing");
    setError(null);

    try {
      const result = await extractText(blob);
      setOcrResult(result);
      setStep("results");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "OCR processing failed",
      );
      setStep("capture");
    } finally {
      // Release image data immediately after OCR
      releaseImageData({ blob });
    }
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      const { query } = buildSearchQuery(text);
      if (query.length > 0) {
        router.push(`/app/search?q=${encodeURIComponent(query)}`);
      }
    },
    [router],
  );

  const handleRetry = useCallback(() => {
    setOcrResult(null);
    setError(null);
    setStep("capture");
  }, []);

  return (
    <AppPage className={surface.appPage}>
      <Breadcrumbs
        items={[
          { labelKey: "nav.home", href: "/app" },
          { labelKey: "nav.imageSearch" },
        ]}
      />

      <AppPageHeader
        eyebrow={t("nav.imageSearch")}
        title={t("imageSearch.title")}
        description={t("imageSearch.description")}
        register={<span data-testid="beta-badge">{t("imageSearch.beta")}</span>}
      />

      {/* Privacy consent dialog */}
      <PrivacyNotice open={showPrivacy} onAccept={handleAcceptPrivacy} />

      {/* Error banner */}
      {error && (
        <div
          className={[surface.state, surface.errorState].join(" ")}
          role="alert"
          data-testid="ocr-error"
        >
          <p className="font-medium">{t("imageSearch.ocrFailed")}</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      )}

      {/* Step: Capture */}
      {step === "capture" && !showPrivacy && (
        <ImageCapture
          onCapture={handleCapture}
          processing={false}
        />
      )}

      {/* Step: Processing */}
      {step === "processing" && (
        <div className={surface.state} data-testid="ocr-processing">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-foreground-secondary">
            {t("imageSearch.processing")}
          </p>
          <p className="text-xs text-foreground-muted">
            {t("imageSearch.processingDetail")}
          </p>
        </div>
      )}

      {/* Step: Results */}
      {step === "results" && ocrResult && (
        <OCRResults
          result={ocrResult}
          onSearch={handleSearch}
          onRetry={handleRetry}
        />
      )}

      {/* Unusable result tip */}
      {step === "results" &&
        ocrResult &&
        ocrResult.confidence < CONFIDENCE.UNUSABLE && (
          <div className={surface.state}>
            {t("imageSearch.unusableTip")}
          </div>
        )}
    </AppPage>
  );
}
