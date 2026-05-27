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
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

// ─── Allergens topic page ──────────────────────────────────────────────────

export default function AllergensPage() {
  const { t } = useTranslation();

  const allergenKeys = Array.from({ length: 14 }, (_, i) => `allergen${i + 1}`);

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
            icon={AlertTriangle}
            title={t("learn.allergens.title")}
            summary={t("learn.allergens.summary")}
          >
            <LearnSectionCard title={t("learn.allergens.eu14Title")}>
              <p>{t("learn.allergens.eu14Text")}</p>
              <ol className="space-y-2 pl-5">
                {allergenKeys.map((key) => (
                  <li key={key}>{t(`learn.allergens.${key}`)}</li>
                ))}
              </ol>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.allergens.containsVsTracesTitle")}>
              <p>{t("learn.allergens.containsVsTracesText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.allergens.polishLabelsTitle")}>
              <p>{t("learn.allergens.polishLabelsText")}</p>
            </LearnSectionCard>

            <LearnSectionCard title={t("learn.allergens.inTryVitTitle")}>
              <p>{t("learn.allergens.inTryVitText")}</p>
            </LearnSectionCard>

            <Disclaimer />

            <LearnSectionCard title={t("learn.sourcesTitle")}>
              <SourceCitation
                author="EU"
                title="Regulation (EU) No 1169/2011 on the provision of food information to consumers"
                year={2011}
                url="https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:32011R1169"
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
