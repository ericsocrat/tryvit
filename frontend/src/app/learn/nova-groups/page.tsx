"use client";

import { Disclaimer } from "@/components/learn/Disclaimer";
import { LearnArticleShell } from "@/components/learn/LearnArticleShell";
import { LearnRouteShell } from "@/components/learn/LearnRouteShell";
import { LearnSectionCard } from "@/components/learn/LearnSectionCard";
import { LearnTopicNav } from "@/components/learn/LearnTopicNav";
import { SourceCitation } from "@/components/learn/SourceCitation";
import { useTranslation } from "@/lib/i18n";
import { Factory } from "lucide-react";

// ─── NOVA Groups topic page ────────────────────────────────────────────────

export default function NovaGroupsPage() {
  const { t } = useTranslation();

  return (
    <LearnRouteShell>
      <LearnArticleShell
            icon={Factory}
            title={t("learn.novaGroups.title")}
            summary={t("learn.novaGroups.summary")}
          >
            <LearnSectionCard title={t("learn.novaGroups.whatIsTitle")}>
              <p>{t("learn.novaGroups.whatIsText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.novaGroups.groupsTitle")}>
              <div className="grid gap-3 md:grid-cols-2">
                {(["1", "2", "3", "4"] as const).map((n) => {
                  const colorMap: Record<string, string> = {
                    "1": "border-success-border bg-success-bg",
                    "2": "border-info-border bg-info-bg",
                    "3": "border-warning-border bg-warning-bg",
                    "4": "border-error-border bg-error-bg",
                  };
                  return (
                    <div
                      key={n}
                      className={`rounded-lg border p-4 ${colorMap[n]}`}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {t(`learn.novaGroups.group${n}Title`)}
                      </p>
                      <p className="mt-1 text-sm text-foreground-secondary">
                        {t(`learn.novaGroups.group${n}Text`)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.novaGroups.whyItMattersTitle")}>
              <p>{t("learn.novaGroups.whyItMattersText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.novaGroups.polishContextTitle")}>
              <p>{t("learn.novaGroups.polishContextText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.novaGroups.processingRiskTitle")}>
              <p>{t("learn.novaGroups.processingRiskText")}</p>
            </LearnSectionCard>

            <Disclaimer />

            <LearnSectionCard title={t("learn.sourcesTitle")}>
              <SourceCitation
                author="Monteiro et al."
                title="Ultra-processed foods: what they are and how to identify them"
                year={2019}
                url="https://doi.org/10.1017/S1368980018003762"
              />
              <SourceCitation
                author="Schnabel et al."
                title="Association between ultra-processed food consumption and risk of mortality"
                year={2019}
                url="https://doi.org/10.1001/jamainternmed.2018.7289"
              />
              <SourceCitation
                author="Fiolet et al."
                title="Consumption of ultra-processed foods and cancer risk"
                year={2018}
                url="https://doi.org/10.1136/bmj.k322"
              />
            </LearnSectionCard>

            <LearnTopicNav />
      </LearnArticleShell>
    </LearnRouteShell>
  );
}
