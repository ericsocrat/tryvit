"use client";

// ─── Onboarding Progress Indicator ──────────────────────────────────────────
// Accessible step progress bar for the onboarding wizard.

import { useTranslation } from "@/lib/i18n";
import type { CSSProperties } from "react";
import styles from "./OnboardingExperience.module.css";

interface OnboardingProgressProps {
  readonly currentStep: number;
  readonly totalSteps: number;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
}: OnboardingProgressProps) {
  const { t } = useTranslation();
  const stepLabel = t("onboarding.stepOf", {
    current: String(currentStep),
    total: String(totalSteps),
  });
  const progressStyle = {
    "--onboarding-step-count": totalSteps,
  } as CSSProperties;

  return (
    <div className={styles.progress}>
      <progress
        className="sr-only"
        value={currentStep}
        max={totalSteps}
        aria-label={stepLabel}
      />
      <div className={styles.progressMeta} aria-hidden="true">
        <span className={styles.registerCaption}>{stepLabel}</span>
      </div>
      <div className={styles.progressBars} style={progressStyle} aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`${styles.progressSegment} ${
              i < currentStep ? styles.progressSegmentComplete : ""
            }`}
            data-testid="onboarding-progress-segment"
          />
        ))}
      </div>
    </div>
  );
}
