// ─── Client-side landing page sections ──────────────────────────────────────
// Extracted from page.tsx to allow the page itself to be a server component
// with static SEO metadata. All sections use useTranslation() → must be client.

"use client";

import { ButtonLink } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { useTranslation } from "@/lib/i18n";
import {
    BarChart3,
    Camera,
    ChevronRight,
    Database,
    Layers,
    Search,
    Shield,
    ShoppingBasket,
    type LucideIcon,
} from "lucide-react";

// ─── Hero ───────────────────────────────────────────────────────────────────

function HeroSection() {
  const { t } = useTranslation();
  return (
    <section className="relative isolate overflow-hidden bg-linear-to-b from-brand/10 via-surface to-surface pb-16 pt-20 sm:pb-24 sm:pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-16 top-8 h-44 w-44 rounded-full bg-brand/18 blur-3xl" />
        <div className="absolute -right-10 top-6 h-56 w-56 rounded-full bg-brand/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-32 w-[75%] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <div className="mx-auto max-w-3xl rounded-3xl border border-strong/40 bg-surface/85 px-6 py-10 text-center shadow-lg backdrop-blur sm:px-10 sm:py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-strong/60 bg-surface-subtle px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Food Health Scanner
          </div>

          <div className="mb-6 flex justify-center">
            <Logo variant="icon" size={72} />
          </div>

          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t("landing.tagline")}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-foreground-secondary sm:text-xl">
            {t("landing.description")}
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink
              href="/auth/signup"
              size="lg"
              className="w-full px-8 sm:w-auto"
              iconRight={<ChevronRight size={18} aria-hidden="true" />}
            >
              {t("landing.getStarted")}
            </ButtonLink>
            <ButtonLink
              href="/auth/login"
              variant="secondary"
              size="lg"
              className="w-full px-8 sm:w-auto"
            >
              {t("landing.signIn")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ───────────────────────────────────────────────────────────────

function FeaturesSection() {
  const { t } = useTranslation();
  const features: { icon: LucideIcon; title: string; desc: string }[] = [
    { icon: Search, title: t("landing.featureSearch"), desc: t("landing.featureSearchDesc") },
    { icon: Camera, title: t("landing.featureScan"), desc: t("landing.featureScanDesc") },
    { icon: BarChart3, title: t("landing.featureCompare"), desc: t("landing.featureCompareDesc") },
  ];
  return (
    <section aria-labelledby="features-heading" className="relative overflow-hidden py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-12 top-8 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute bottom-4 right-8 h-36 w-36 rounded-full bg-brand/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <h2 id="features-heading" className="mb-3 text-center text-2xl font-bold text-foreground sm:text-3xl">
          {t("landing.featuresHeading")}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-foreground-secondary sm:text-base">
          Search, scan, and compare with the same scoring logic across products and categories.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-strong/50 bg-surface px-5 py-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
            >
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-brand/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-brand/30 bg-brand/12 transition-colors duration-300 group-hover:bg-brand/18">
                <f.icon size={28} aria-hidden="true" className="text-brand" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-foreground-secondary">{f.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ───────────────────────────────────────────────────────────

function HowItWorksSection() {
  const { t } = useTranslation();
  const steps: { num: number; icon: LucideIcon; title: string; desc: string }[] = [
    { num: 1, icon: Search, title: t("landing.step1Title"), desc: t("landing.step1Desc") },
    { num: 2, icon: Shield, title: t("landing.step2Title"), desc: t("landing.step2Desc") },
    { num: 3, icon: ShoppingBasket, title: t("landing.step3Title"), desc: t("landing.step3Desc") },
  ];
  return (
    <section aria-labelledby="how-it-works-heading" className="relative isolate overflow-hidden bg-surface-subtle py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-12 h-36 w-36 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute right-0 top-20 h-44 w-44 rounded-full bg-brand/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <h2 id="how-it-works-heading" className="mb-3 text-center text-2xl font-bold text-foreground sm:text-3xl">
          {t("landing.howItWorksHeading")}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-foreground-secondary sm:text-base">
          Three quick steps from discovery to confident choices.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <article
              key={s.num}
              className="group relative flex flex-col items-center rounded-2xl border border-strong/50 bg-surface px-5 py-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
            >
              <div className="pointer-events-none absolute left-1/2 top-0 hidden h-px w-[70%] -translate-x-1/2 bg-linear-to-r from-transparent via-brand/40 to-transparent sm:block" />
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand/25 bg-brand/12 text-brand transition-colors duration-300 group-hover:bg-brand/18">
                <s.icon size={28} aria-hidden="true" />
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-brand text-xs font-bold text-foreground-inverse shadow-sm">
                  {s.num}
                </span>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm leading-relaxed text-foreground-secondary">{s.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Data Stats ─────────────────────────────────────────────────────────────

function DataStatsSection() {
  const { t } = useTranslation();
  const stats: { icon: LucideIcon; value: string; label: string }[] = [
    { icon: ShoppingBasket, value: t("landing.statProductsValue"), label: t("landing.statProducts") },
    { icon: Layers, value: t("landing.statCategoriesValue"), label: t("landing.statCategories") },
    { icon: Database, value: t("landing.statFactorsValue"), label: t("landing.statFactors") },
    { icon: Shield, value: t("landing.statCountriesValue"), label: t("landing.statCountries") },
  ];
  return (
    <section aria-labelledby="stats-heading" className="relative isolate overflow-hidden py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-6 bottom-6 h-36 w-36 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -right-6 top-8 h-44 w-44 rounded-full bg-brand/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <h2 id="stats-heading" className="mb-3 text-center text-2xl font-bold text-foreground sm:text-3xl">
          {t("landing.statsHeading")}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-foreground-secondary sm:text-base">
          Transparent data scale across products, categories, and scoring factors.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {stats.map((s) => (
            <article
              key={s.label}
              className="group rounded-2xl border border-strong/50 bg-surface px-4 py-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg sm:px-5 sm:py-6"
            >
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand/25 bg-brand/12 text-brand transition-colors duration-300 group-hover:bg-brand/18">
                <s.icon size={22} aria-hidden="true" />
              </div>
              <span className="block text-3xl font-extrabold leading-none text-foreground sm:text-4xl">{s.value}</span>
              <span className="mt-2 block text-xs font-medium uppercase tracking-[0.06em] text-foreground-secondary sm:text-sm">{s.label}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Repeat ─────────────────────────────────────────────────────────────

function CtaRepeatSection() {
  const { t } = useTranslation();
  return (
    <section className="relative isolate overflow-hidden bg-linear-to-b from-brand/8 to-surface py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/12 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl px-4 text-center">
        <div className="rounded-3xl border border-strong/50 bg-surface/85 px-6 py-10 shadow-lg backdrop-blur sm:px-10 sm:py-12">
        <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
          {t("landing.ctaHeading")}
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
          {t("landing.ctaDescription")}
        </p>
        <ButtonLink
          href="/auth/signup"
          size="lg"
          className="w-full px-10 sm:w-auto"
          iconRight={<ChevronRight size={18} aria-hidden="true" />}
        >
          {t("landing.getStarted")}
        </ButtonLink>
        </div>
      </div>
    </section>
  );
}

// ─── Combined export ────────────────────────────────────────────────────────

export function LandingSections() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DataStatsSection />
      <CtaRepeatSection />
    </>
  );
}
