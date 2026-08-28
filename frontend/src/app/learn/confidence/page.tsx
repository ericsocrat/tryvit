"use client";

import { Disclaimer } from "@/components/learn/Disclaimer";
import { LearnArticleShell } from "@/components/learn/LearnArticleShell";
import { LearnRouteShell } from "@/components/learn/LearnRouteShell";
import { LearnSectionCard } from "@/components/learn/LearnSectionCard";
import { LearnTopicNav } from "@/components/learn/LearnTopicNav";
import { SourceCitation } from "@/components/learn/SourceCitation";
import { useTranslation } from "@/lib/i18n";
import { AlertTriangle, BadgeCheck, Ruler, type LucideIcon } from "lucide-react";

// ─── Data Confidence topic page ────────────────────────────────────────────

export default function ConfidencePage() {
  const { t } = useTranslation();

  const levels: { key: string; color: string; icon: LucideIcon }[] = [
    {
      key: "levelVerified",
      color: "bg-success-bg border-success-border",
      icon: BadgeCheck,
    },
    {
      key: "levelEstimated",
      color: "bg-warning-bg border-warning-border",
      icon: Ruler,
    },
    {
      key: "levelLow",
      color: "bg-error-bg border-error-border",
      icon: AlertTriangle,
    },
  ];

  return (
    <LearnRouteShell>
      <LearnArticleShell
            icon={BadgeCheck}
            title={t("learn.confidence.title")}
            summary={t("learn.confidence.summary")}
          >
            <LearnSectionCard title={t("learn.confidence.whyTitle")}>
              <p>{t("learn.confidence.whyText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.confidence.levelsTitle")}>
              <div className="space-y-3">
                {levels.map(({ key, color, icon: LevelIcon }) => (
                  <div key={key} className={`rounded-lg border p-4 ${color}`}>
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <LevelIcon size={16} aria-hidden="true" />
                      {t(`learn.confidence.${key}`)}
                    </p>
                  </div>
                ))}
              </div>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.confidence.completenessTitle")}>
              <p>{t("learn.confidence.completenessText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.confidence.howWeImproveTitle")}>
              <p>{t("learn.confidence.howWeImproveText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.confidence.whatYouCanDoTitle")}>
              <p>{t("learn.confidence.whatYouCanDoText")}</p>
            </LearnSectionCard>

            <Disclaimer />

            <LearnSectionCard title={t("learn.sourcesTitle")}>
              <SourceCitation
                author="EFSA"
                title="Guidance on the assessment of the safety of feed additives"
                year={2017}
              />
              <SourceCitation
                author="Open Food Facts"
                title="Data quality framework and completeness metrics"
                url="https://wiki.openfoodfacts.org/Data_quality"
              />
            </LearnSectionCard>

            <LearnTopicNav />
      </LearnArticleShell>
    </LearnRouteShell>
  );
}
