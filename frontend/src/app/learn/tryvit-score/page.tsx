"use client";

import { Disclaimer } from "@/components/learn/Disclaimer";
import { LearnArticleShell } from "@/components/learn/LearnArticleShell";
import { LearnRouteShell } from "@/components/learn/LearnRouteShell";
import { LearnSectionCard } from "@/components/learn/LearnSectionCard";
import { LearnTopicNav } from "@/components/learn/LearnTopicNav";
import { SourceCitation } from "@/components/learn/SourceCitation";
import { useTranslation } from "@/lib/i18n";
import { BarChart3 } from "lucide-react";

// ─── TryVit Score topic page ─────────────────────────────────────────

const penaltyFactors = [
  { key: "factorSatFat", weight: 17 },
  { key: "factorSugars", weight: 17 },
  { key: "factorSalt", weight: 17 },
  { key: "factorCalories", weight: 10 },
  { key: "factorTransFat", weight: 11 },
  { key: "factorAdditives", weight: 7 },
  { key: "factorPrepMethod", weight: 8 },
  { key: "factorControversies", weight: 8 },
  { key: "factorConcern", weight: 5 },
] as const;

const bonusFactor = { key: "factorNutrientDensity", weight: 8 } as const;

export default function TryVitScorePage() {
  const { t } = useTranslation();

  const bands = ["band1", "band2", "band3", "band4", "band5"] as const;
  const bandColors = [
    "bg-success-bg border-success-border",
    "bg-band-good-bg border-band-good-border",
    "bg-warning-bg border-warning-border",
    "bg-band-caution-bg border-band-caution-border",
    "bg-error-bg border-error-border",
  ];

  return (
    <LearnRouteShell>
      <LearnArticleShell
            icon={BarChart3}
            title={t("learn.tryvitScore.title")}
            summary={t("learn.tryvitScore.summary")}
          >
            <LearnSectionCard title={t("learn.tryvitScore.whatIsTitle")}>
              <p>{t("learn.tryvitScore.whatIsText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.tryvitScore.factorsTitle")}>
              <div className="space-y-3">
                {penaltyFactors.map(({ key, weight }) => (
                  <div
                    key={key}
                    className="rounded-xl border border-border/70 bg-surface-subtle p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          {t(`learn.tryvitScore.${key}`)}
                        </p>
                      </div>
                      <div className="flex w-28 shrink-0 items-center gap-2">
                        <div className="relative h-2 flex-1 rounded-full bg-(--color-border)">
                          <div
                            className="absolute left-0 top-0 h-full rounded-full bg-brand"
                            style={{ width: `${(weight / 17) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-medium text-muted">
                          {weight}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </LearnSectionCard>

            <LearnSectionCard
              title={t("learn.tryvitScore.bonusTitle")}
              className="border-success-border bg-success-bg/70"
            >
              <div className="rounded-xl border border-success-border bg-success-bg p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {t(`learn.tryvitScore.${bonusFactor.key}`)}
                    </p>
                  </div>
                  <div className="flex w-28 shrink-0 items-center gap-2">
                    <div className="relative h-2 flex-1 rounded-full bg-(--color-border)">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-success"
                        style={{ width: `${(bonusFactor.weight / 17) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-medium text-success-text">
                      −{bonusFactor.weight}%
                    </span>
                  </div>
                </div>
              </div>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.tryvitScore.bandsTitle")}>
              <div className="space-y-3">
                {bands.map((key, i) => (
                  <div
                    key={key}
                    className={`rounded-lg border p-4 ${bandColors[i]}`}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {t(`learn.tryvitScore.${key}`)}
                    </p>
                  </div>
                ))}
              </div>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.tryvitScore.formulaTitle")}>
              <p>{t("learn.tryvitScore.formulaText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.tryvitScore.whyDifferentTitle")}>
              <p>{t("learn.tryvitScore.whyDifferentText")}</p>
            </LearnSectionCard>

            <Disclaimer />

            <LearnSectionCard title={t("learn.sourcesTitle")}>
              <SourceCitation
                author="WHO"
                title="Guideline: Sugars intake for adults and children"
                year={2015}
                url="https://www.who.int/publications/i/item/9789241549028"
              />
              <SourceCitation
                author="WHO"
                title="Guideline: Sodium intake for adults and children"
                year={2023}
                url="https://www.who.int/publications/i/item/9789240073784"
              />
              <SourceCitation
                author="EFSA"
                title="Scientific opinion on dietary reference values for fats"
                year={2010}
              />
              <SourceCitation
                author="EU"
                title="Regulation 2019/649 on trans fatty acids"
                year={2019}
              />
            </LearnSectionCard>

            <LearnTopicNav />
      </LearnArticleShell>
    </LearnRouteShell>
  );
}
