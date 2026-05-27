"use client";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Disclaimer } from "@/components/learn/Disclaimer";
import { LearnArticleShell } from "@/components/learn/LearnArticleShell";
import { LearnSectionCard } from "@/components/learn/LearnSectionCard";
import { LearnSidebar } from "@/components/learn/LearnSidebar";
import { LearnTopicNav } from "@/components/learn/LearnTopicNav";
import { SourceCitation } from "@/components/learn/SourceCitation";
import { useTranslation } from "@/lib/i18n";
import { FlaskConical } from "lucide-react";
import Link from "next/link";

// ─── Additives topic page ──────────────────────────────────────────────────

export default function AdditivesPage() {
  const { t } = useTranslation();

  const tiers = [
    "concernTier0",
    "concernTier1",
    "concernTier2",
    "concernTier3",
  ] as const;
  const tierColors = [
    "bg-success-bg border-success-border",
    "bg-info-bg border-info-border",
    "bg-warning-bg border-warning-border",
    "bg-error-bg border-error-border",
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-4 py-8">
        <LearnSidebar className="w-56 shrink-0" />

        <main id="main-content" className="min-w-0 flex-1">
          <Link
            href="/learn"
            className="mb-4 inline-block text-sm text-brand hover:text-brand-hover md:hidden"
          >
            {t("learn.backToHub")}
          </Link>

          <LearnArticleShell
            icon={FlaskConical}
            title={t("learn.additives.title")}
            summary={t("learn.additives.summary")}
          >
            <LearnSectionCard title={t("learn.additives.whatAreTitle")}>
              <p>{t("learn.additives.whatAreText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.additives.notDangerousTitle")}>
              <p>{t("learn.additives.notDangerousText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.additives.concernTiersTitle")}>
              <div className="grid gap-3 md:grid-cols-2">
                {tiers.map((key, i) => (
                  <div
                    key={key}
                    className={`rounded-lg border p-4 ${tierColors[i]}`}
                  >
                    <p className="text-sm text-foreground">
                      {t(`learn.additives.${key}`)}
                    </p>
                  </div>
                ))}
              </div>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.additives.howWeUseTitle")}>
              <p>{t("learn.additives.howWeUseText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.additives.polishContextTitle")}>
              <p>{t("learn.additives.polishContextText")}</p>
            </LearnSectionCard>

            <Disclaimer />

            <LearnSectionCard title={t("learn.sourcesTitle")}>
              <SourceCitation
                author="EFSA"
                title="Re-evaluation of food additives programme"
                url="https://www.efsa.europa.eu/en/topics/topic/food-additive-re-evaluations"
              />
              <SourceCitation
                author="EU"
                title="Regulation (EC) No 1333/2008 on food additives"
                year={2008}
              />
            </LearnSectionCard>

            <LearnTopicNav />
          </LearnArticleShell>
        </main>
      </div>

      <Footer />
    </div>
  );
}
