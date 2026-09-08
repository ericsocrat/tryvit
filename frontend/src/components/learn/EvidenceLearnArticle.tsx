"use client";

import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Disclaimer } from "./Disclaimer";
import { LearnArticleShell } from "./LearnArticleShell";
import { LearnRouteShell } from "./LearnRouteShell";
import { LearnSectionCard } from "./LearnSectionCard";
import { LearnTopicNav } from "./LearnTopicNav";
import { SourceCitation } from "./SourceCitation";

type Topic = "score" | "confidence" | "additives" | "choices";
const SOURCES: Record<Topic, { author: string; title: string; url: string }[]> = {
  score: [{ author: "WHO", title: "Healthy diet", url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet" }],
  confidence: [{ author: "Open Food Facts", title: "Product nutrition schema", url: "https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/" }],
  additives: [{ author: "EFSA", title: "Food additives", url: "https://www.efsa.europa.eu/en/topics/topic/food-additives" }],
  choices: [{ author: "WHO", title: "Healthy diet", url: "https://www.who.int/news-room/fact-sheets/detail/healthy-diet" }],
};

/** Policy and limitations, not a scientific endorsement of a TryVit formula. */
export function EvidenceLearnArticle({ topic, icon }: Readonly<{ topic: Topic; icon: LucideIcon }>) {
  const { t } = useTranslation();
  const key = `evidenceLearn.${topic}`;
  return <LearnRouteShell>
    <LearnArticleShell icon={icon} title={t(`${key}.title`)} summary={t(`${key}.summary`)}>
      {["meaning", "limits", "action"].map((section) => <LearnSectionCard key={section} title={t(`${key}.${section}Title`)}>
        <p>{t(`${key}.${section}Text`)}</p>
      </LearnSectionCard>)}
      <Disclaimer />
      <LearnSectionCard title={t("learn.sourcesTitle")}>
        <p>{t("evidenceLearn.sourceLimit")}</p>
        {SOURCES[topic].map((source) => <SourceCitation key={source.url} {...source} />)}
      </LearnSectionCard>
      <LearnTopicNav />
    </LearnArticleShell>
  </LearnRouteShell>;
}
