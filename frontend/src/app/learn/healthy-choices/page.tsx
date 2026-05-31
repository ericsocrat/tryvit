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
import { Heart } from "lucide-react";
import Link from "next/link";

// ─── Making Healthier Choices topic page ───────────────────────────────────

export default function HealthyChoicesPage() {
  const { t } = useTranslation();

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
            icon={Heart}
            title={t("learn.healthyChoices.title")}
            summary={t("learn.healthyChoices.summary")}
          >
            <LearnSectionCard title={t("learn.healthyChoices.startSmallTitle")}>
              <p>{t("learn.healthyChoices.startSmallText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.healthyChoices.compareTitle")}>
              <p>{t("learn.healthyChoices.compareText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.healthyChoices.readLabelsTitle")}>
              <p>{t("learn.healthyChoices.readLabelsText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.healthyChoices.processingTitle")}>
              <p>{t("learn.healthyChoices.processingText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.healthyChoices.allergenTitle")}>
              <p>{t("learn.healthyChoices.allergenText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.healthyChoices.habitsTitle")}>
              <p>{t("learn.healthyChoices.habitsText")}</p>
            </LearnSectionCard>

            <Disclaimer />

            <LearnSectionCard title={t("learn.sourcesTitle")}>
              <SourceCitation
                author="WHO"
                title="Healthy diet fact sheet"
                year={2024}
                url="https://www.who.int/news-room/fact-sheets/detail/healthy-diet"
              />
              <SourceCitation
                author="EFSA"
                title="Dietary reference values for nutrients"
                url="https://www.efsa.europa.eu/en/topics/topic/dietary-reference-values"
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
