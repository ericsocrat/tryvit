"use client";

import { Disclaimer } from "@/components/learn/Disclaimer";
import { LearnArticleShell } from "@/components/learn/LearnArticleShell";
import { LearnRouteShell } from "@/components/learn/LearnRouteShell";
import { LearnSectionCard } from "@/components/learn/LearnSectionCard";
import { LearnTopicNav } from "@/components/learn/LearnTopicNav";
import { SourceCitation } from "@/components/learn/SourceCitation";
import { useTranslation } from "@/lib/i18n";
import { Award } from "lucide-react";

// ─── Nutri-Score topic page ─────────────────────────────────────────────────

export default function NutriScorePage() {
  const { t } = useTranslation();

  return (
    <LearnRouteShell>
      <LearnArticleShell
            icon={Award}
            title={t("learn.nutriScore.title")}
            summary={t("learn.nutriScore.summary")}
          >
            <LearnSectionCard title={t("learn.nutriScore.whatIsTitle")}>
              <p>{t("learn.nutriScore.whatIsText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.nutriScore.howItWorksTitle")}>
              <p>{t("learn.nutriScore.howItWorksText")}</p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-error-border bg-error-bg p-4">
                  <p className="text-sm font-medium text-error-text">
                    {t("learn.nutriScore.negativeLabel")}
                  </p>
                  <p className="mt-1 text-sm text-error-text">
                    {t("learn.nutriScore.negativeItems")}
                  </p>
                </div>
                <div className="rounded-xl border border-success-border bg-success-bg p-4">
                  <p className="text-sm font-medium text-success-text">
                    {t("learn.nutriScore.positiveLabel")}
                  </p>
                  <p className="mt-1 text-sm text-success-text">
                    {t("learn.nutriScore.positiveItems")}
                  </p>
                </div>
              </div>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.nutriScore.gradesTitle")}>
              <ul className="space-y-2">
                <li>
                  <strong>{t("learn.nutriScore.gradeA")}</strong>
                </li>
                <li>
                  <strong>{t("learn.nutriScore.gradeB")}</strong>
                </li>
                <li>
                  <strong>{t("learn.nutriScore.gradeC")}</strong>
                </li>
                <li>
                  <strong>{t("learn.nutriScore.gradeD")}</strong>
                </li>
                <li>
                  <strong>{t("learn.nutriScore.gradeE")}</strong>
                </li>
              </ul>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.nutriScore.limitationsTitle")}>
              <p>{t("learn.nutriScore.limitationsText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.nutriScore.unknownTitle")}>
              <p>{t("learn.nutriScore.unknownText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.nutriScore.ourApproachTitle")}>
              <p>{t("learn.nutriScore.ourApproachText")}</p>
            </LearnSectionCard>

            <Disclaimer />

            <LearnSectionCard title={t("learn.sourcesTitle")}>
              <SourceCitation
                author="Santé Publique France"
                title="Nutri-Score algorithm update 2024"
                year={2024}
                url="https://www.santepubliquefrance.fr/en/nutri-score"
              />
              <SourceCitation
                author="EFSA"
                title="Scientific opinion on dietary reference values for fats"
                year={2010}
                url="https://www.efsa.europa.eu/en/efsajournal/pub/1461"
              />
            </LearnSectionCard>

            <LearnTopicNav />
      </LearnArticleShell>
    </LearnRouteShell>
  );
}
