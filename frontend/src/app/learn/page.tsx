"use client";

import {
  PublicUtilityShell,
  publicUtilityStyles,
} from "@/components/layout/PublicUtilityShell";
import { Disclaimer } from "@/components/learn/Disclaimer";
import { LearnCard } from "@/components/learn/LearnCard";
import { eventBus } from "@/lib/events";
import { useTranslation } from "@/lib/i18n";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BarChart3,
  Factory,
  FlaskConical,
  Heart,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";

/** Topics for the hub index page. */
const TOPICS: readonly {
  slug: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}[] = [
  {
    slug: "nutri-score",
    icon: Award,
    titleKey: "learn.nutriScore.title",
    descKey: "learn.nutriScore.description",
  },
  {
    slug: "nova-groups",
    icon: Factory,
    titleKey: "learn.novaGroups.title",
    descKey: "learn.novaGroups.description",
  },
  {
    slug: "tryvit-score",
    icon: BarChart3,
    titleKey: "learn.tryvitScore.title",
    descKey: "learn.tryvitScore.description",
  },
  {
    slug: "additives",
    icon: FlaskConical,
    titleKey: "learn.additives.title",
    descKey: "learn.additives.description",
  },
  {
    slug: "allergens",
    icon: AlertTriangle,
    titleKey: "learn.allergens.title",
    descKey: "learn.allergens.description",
  },
  {
    slug: "reading-labels",
    icon: Tag,
    titleKey: "learn.readingLabels.title",
    descKey: "learn.readingLabels.description",
  },
  {
    slug: "confidence",
    icon: BadgeCheck,
    titleKey: "learn.confidence.title",
    descKey: "learn.confidence.description",
  },
  {
    slug: "healthy-choices",
    icon: Heart,
    titleKey: "learn.healthyChoices.title",
    descKey: "learn.healthyChoices.description",
  },
];

export default function LearnHubPage() {
  const { t } = useTranslation();

  useEffect(() => {
    void eventBus.emit({ type: "learn.page_viewed", payload: {} });
  }, []);

  return (
    <PublicUtilityShell
      eyebrow={t("nav.learn")}
      title={t("learn.hubTitle")}
      description={t("learn.hubSubtitle")}
      register={<span>{t("learn.hubDescription")}</span>}
    >
      <Disclaimer />
      <section>
        <h2>{t("learn.learnMore")}</h2>
        <div className={publicUtilityStyles.grid}>
          {TOPICS.map(({ slug, icon, titleKey, descKey }) => (
            <LearnCard
              key={slug}
              icon={icon}
              title={t(titleKey)}
              description={t(descKey)}
              href={`/learn/${slug}`}
            />
          ))}
        </div>
      </section>
    </PublicUtilityShell>
  );
}
