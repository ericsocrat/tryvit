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
import { Tag } from "lucide-react";
import Link from "next/link";

// ─── Reading Labels topic page ─────────────────────────────────────────────

export default function ReadingLabelsPage() {
  const { t } = useTranslation();

  const mandatoryItems = Array.from(
    { length: 9 },
    (_, i) => `mandatoryItem${i + 1}`,
  );
  const tips = Array.from({ length: 5 }, (_, i) => `tip${i + 1}`);

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
            icon={Tag}
            title={t("learn.readingLabels.title")}
            summary={t("learn.readingLabels.summary")}
          >
            <LearnSectionCard title={t("learn.readingLabels.nutritionTableTitle")}>
              <p>{t("learn.readingLabels.nutritionTableText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.readingLabels.per100gTitle")}>
              <p>{t("learn.readingLabels.per100gText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.readingLabels.mandatoryTitle")}>
              <ol className="space-y-2 pl-5">
                {mandatoryItems.map((key) => (
                  <li key={key}>{t(`learn.readingLabels.${key}`)}</li>
                ))}
              </ol>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.readingLabels.tipsTitle")}>
              <ul className="space-y-2 pl-5">
                {tips.map((key) => (
                  <li key={key}>{t(`learn.readingLabels.${key}`)}</li>
                ))}
              </ul>
            </LearnSectionCard>

            <Disclaimer />

            <LearnSectionCard title={t("learn.sourcesTitle")}>
              <SourceCitation
                author="EU"
                title="Regulation (EU) No 1169/2011 on the provision of food information to consumers"
                year={2011}
                url="https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:32011R1169"
              />
              <SourceCitation
                author="EU"
                title="Regulation (EU) No 1169/2011, Annex XIII — Reference intakes"
                year={2011}
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
