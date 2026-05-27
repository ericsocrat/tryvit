"use client";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Disclaimer } from "@/components/learn/Disclaimer";
import { LearnCard } from "@/components/learn/LearnCard";
import { eventBus } from "@/lib/events";
import { useTranslation } from "@/lib/i18n";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
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
    <div className="flex min-h-screen flex-col">
      <Header />

      <main
        id="main-content"
        className="flex-1 bg-linear-to-b from-brand-subtle/35 via-surface to-surface px-4 py-10 md:py-14"
      >
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Hero */}
          <section className="overflow-hidden rounded-4xl border border-border/70 bg-surface/95 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm md:p-8 dark:shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
            <p className="inline-flex rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              Learn
            </p>

            <h1 className="mt-4 flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              <BookOpen size={30} aria-hidden="true" />
              {t("learn.hubTitle")}
            </h1>

            <p className="mt-3 max-w-3xl text-lg leading-8 text-foreground-secondary">
              {t("learn.hubSubtitle")}
            </p>

            <p className="mt-2 max-w-3xl text-base leading-7 text-foreground-secondary">
              {t("learn.hubDescription")}
            </p>
          </section>

          {/* Disclaimer */}
          <Disclaimer className="rounded-2xl border border-warning-border/70 bg-warning-bg/70 p-4 shadow-sm" />

          <section className="space-y-5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {t("learn.learnMore")}
            </h2>

            {/* Topic grid */}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {TOPICS.map(({ slug, icon, titleKey, descKey }) => (
                <LearnCard
                  key={slug}
                  icon={icon}
                  title={t(titleKey)}
                  description={t(descKey)}
                  href={`/learn/${slug}`}
                  className="h-full"
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
