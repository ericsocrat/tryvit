// ─── Client-side landing page sections ──────────────────────────────────────
// Extracted from page.tsx to allow the page itself to be a server component
// with static SEO metadata. All sections use useTranslation() → must be client.

"use client";

import { ButtonLink } from "@/components/common/Button";
import { Logo } from "@/components/common/Logo";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
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
import { useEffect, useState } from "react";

// ─── Auth state ─────────────────────────────────────────────────────────────
// Mirrors the client-side auth pattern in Header.tsx so the landing CTAs can
// show a Dashboard link to logged-in users while keeping `/` a static page.

function useIsAuthenticated(enabled: boolean): boolean {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    try {
      const client = createClient();

      client.auth.getUser().then(({ data }) => {
        if (active) {
          setIsAuthenticated(!!data.user);
        }
      });

      const onAuthStateChange = client.auth.onAuthStateChange;
      if (typeof onAuthStateChange !== "function") {
        return () => {
          active = false;
        };
      }

      const authListenerResult = onAuthStateChange((_event, session) => {
        if (active) {
          setIsAuthenticated(!!session?.user);
        }
      });

      return () => {
        active = false;
        authListenerResult.data.subscription.unsubscribe();
      };
    } catch {
      return () => {
        active = false;
      };
    }
  }, [enabled]);

  return isAuthenticated;
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function HeroSection({
  dataAvailable,
  isAuthenticated,
}: {
  dataAvailable: boolean;
  isAuthenticated: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="relative isolate overflow-hidden bg-linear-to-b from-brand/12 via-surface to-surface pb-16 pt-16 sm:pb-24 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-6 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-brand/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-40 w-[80%] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-surface/40 to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <div className="rounded-3xl border border-strong/45 bg-surface/90 p-5 shadow-lg backdrop-blur sm:p-8 lg:p-10 dark:border-white/15 dark:bg-white/[0.03] dark:shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr,0.85fr] lg:gap-10">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-strong/60 bg-surface-subtle px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Food Health Scanner
              </div>

              <div className="mb-5 flex items-center gap-4">
                <Logo variant="icon" size={62} />
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground-secondary">
                    TryVit
                  </p>
                  <p className="text-sm text-foreground-secondary">Nutrition clarity at a glance</p>
                </div>
              </div>

              <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t("landing.tagline")}
              </h1>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed text-foreground-secondary sm:text-xl">
                {t(dataAvailable ? "landing.description" : "landing.demoDescription")}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                {!dataAvailable ? (
                  <>
                    <ButtonLink
                      href="#service-status"
                      size="lg"
                      className="w-full px-8 sm:w-auto"
                    >
                      {t("landing.viewStatus")}
                    </ButtonLink>
                    <ButtonLink
                      href="/contact"
                      variant="secondary"
                      size="lg"
                      className="w-full px-8 sm:w-auto"
                    >
                      {t("layout.contact")}
                    </ButtonLink>
                  </>
                ) : isAuthenticated ? (
                  <ButtonLink
                    href="/app"
                    size="lg"
                    className="w-full px-8 sm:w-auto"
                    iconRight={<ChevronRight size={18} aria-hidden="true" />}
                  >
                    {t("auth.dashboard")}
                  </ButtonLink>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            <aside className="rounded-2xl border border-strong/50 bg-surface-subtle/80 p-4 shadow-sm dark:border-white/12 dark:bg-white/[0.02]">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-foreground-secondary">
                Model Snapshot
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-strong/50 bg-surface px-3 py-3 text-center dark:border-white/12 dark:bg-white/[0.03]">
                  <p className="text-2xl font-bold text-foreground">{t("landing.statProductsValue")}</p>
                  <p className="text-xs text-foreground-secondary">Products</p>
                </div>
                <div className="rounded-xl border border-strong/50 bg-surface px-3 py-3 text-center dark:border-white/12 dark:bg-white/[0.03]">
                  <p className="text-2xl font-bold text-foreground">9</p>
                  <p className="text-xs text-foreground-secondary">Score Factors</p>
                </div>
                <div className="rounded-xl border border-strong/50 bg-surface px-3 py-3 text-center dark:border-white/12 dark:bg-white/[0.03]">
                  <p className="text-2xl font-bold text-foreground">2</p>
                  <p className="text-xs text-foreground-secondary">Countries</p>
                </div>
                <div className="rounded-xl border border-strong/50 bg-surface px-3 py-3 text-center dark:border-white/12 dark:bg-white/[0.03]">
                  <p className="text-2xl font-bold text-foreground">A-E</p>
                  <p className="text-xs text-foreground-secondary">Nutri-Score</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-brand/25 bg-brand/10 px-3 py-2 text-xs text-foreground-secondary">
                Built for fast scanner decisions, ingredient transparency, and healthier swaps.
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

function ServiceStatusBanner() {
  const { t } = useTranslation();

  return (
    <section
      id="service-status"
      aria-labelledby="service-status-heading"
      className="border-b border-warning/35 bg-warning/10"
    >
      <div className="mx-auto max-w-5xl px-4 py-5">
        <div className="rounded-2xl border border-warning/45 bg-surface/95 p-5 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-warning">
            {t("landing.demoMode")}
          </p>
          <h2 id="service-status-heading" className="text-lg font-bold text-foreground">
            {t("landing.serviceStatusTitle")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground-secondary">
            {t("landing.serviceStatusDescription")}
          </p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-success/10 px-3 py-2">
              <dt className="font-semibold text-foreground">{t("landing.applicationStatus")}</dt>
              <dd className="text-foreground-secondary">{t("landing.available")}</dd>
            </div>
            <div className="rounded-xl bg-warning/10 px-3 py-2">
              <dt className="font-semibold text-foreground">{t("landing.dataStatus")}</dt>
              <dd className="text-foreground-secondary">{t("landing.paused")}</dd>
            </div>
            <div className="rounded-xl bg-surface-subtle px-3 py-2">
              <dt className="font-semibold text-foreground">{t("landing.productReadiness")}</dt>
              <dd className="text-foreground-secondary">{t("landing.demoOnly")}</dd>
            </div>
          </dl>
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
    <section aria-labelledby="features-heading" className="relative isolate overflow-hidden py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-10 top-10 h-44 w-44 rounded-full bg-brand/12 blur-3xl" />
        <div className="absolute bottom-8 right-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-brand/5 to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <h2 id="features-heading" className="mb-3 text-center text-2xl font-bold text-foreground sm:text-3xl">
          {t("landing.featuresHeading")}
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-foreground-secondary sm:text-base">
          Search, scan, and compare with the same scoring logic across products and categories.
        </p>
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-foreground-secondary">
          <span className="rounded-full border border-strong/60 bg-surface-subtle px-3 py-1">Search First</span>
          <span className="rounded-full border border-strong/60 bg-surface-subtle px-3 py-1">Scan Fast</span>
          <span className="rounded-full border border-strong/60 bg-surface-subtle px-3 py-1">Compare Clearly</span>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f, idx) => (
            <article
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-strong/50 bg-surface px-5 py-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-brand/55"
            >
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-brand/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/8 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl border border-brand/30 bg-brand/12 transition-colors duration-300 group-hover:bg-brand/18">
                <f.icon size={28} aria-hidden="true" className="text-brand" />
              </div>

              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-secondary">
                  0{idx + 1}
                </span>
              </div>

              <h3 className="mb-2 text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-foreground-secondary">{f.desc}</p>

              <div className="mt-4 h-1 w-16 rounded-full bg-brand/30 transition-all duration-300 group-hover:w-24 group-hover:bg-brand/55" />
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
        <div className="absolute left-0 top-12 h-40 w-40 rounded-full bg-brand/12 blur-3xl" />
        <div className="absolute right-0 top-20 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-brand/6 to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <h2 id="how-it-works-heading" className="mb-3 text-center text-2xl font-bold text-foreground sm:text-3xl">
          {t("landing.howItWorksHeading")}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-foreground-secondary sm:text-base">
          Three quick steps from discovery to confident choices.
        </p>

        <div className="mb-8 flex items-center justify-center gap-3 text-xs font-medium uppercase tracking-[0.08em] text-foreground-secondary">
          <span>Discover</span>
          <span className="h-px w-8 bg-brand/45" />
          <span>Evaluate</span>
          <span className="h-px w-8 bg-brand/45" />
          <span>Choose</span>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, idx) => (
            <article
              key={s.num}
              className="group relative flex flex-col rounded-2xl border border-strong/50 bg-surface px-5 py-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/45 hover:shadow-lg dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-brand/55"
            >
              {idx < steps.length - 1 && (
                <div className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-brand/35 sm:block" />
              )}

              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-secondary">
                  Step
                </span>
                <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                  {s.num}
                </span>
              </div>

              <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/25 bg-brand/12 text-brand transition-colors duration-300 group-hover:bg-brand/20">
                <s.icon size={28} aria-hidden="true" />
              </div>

              <h3 className="mb-2 text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm leading-relaxed text-foreground-secondary">{s.desc}</p>

              <div className="mt-4 h-1 w-14 rounded-full bg-brand/30 transition-all duration-300 group-hover:w-24 group-hover:bg-brand/55" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Data Stats ─────────────────────────────────────────────────────────────

function DataStatsSection({ dataAvailable }: { dataAvailable: boolean }) {
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
        <div className="absolute -left-8 bottom-4 h-44 w-44 rounded-full bg-brand/12 blur-3xl" />
        <div className="absolute -right-8 top-4 h-52 w-52 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-brand/6 to-transparent" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <h2 id="stats-heading" className="mb-3 text-center text-2xl font-bold text-foreground sm:text-3xl">
          {t("landing.statsHeading")}
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-foreground-secondary sm:text-base">
          Transparent data scale across products, categories, and scoring factors.
        </p>

        <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-strong/60 bg-surface/90 px-4 py-3 text-center text-xs font-medium uppercase tracking-[0.08em] text-foreground-secondary shadow-sm dark:border-white/12 dark:bg-white/[0.03]">
          {t(dataAvailable ? "landing.liveMetrics" : "landing.demoMetrics")}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {stats.map((s, idx) => (
            <article
              key={s.label}
              className={`group relative overflow-hidden rounded-2xl border bg-surface px-4 py-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:px-5 sm:py-6 dark:bg-white/[0.03] ${
                idx === 0
                  ? "border-brand/50 shadow-md hover:border-brand/65 dark:border-brand/45"
                  : "border-strong/50 hover:border-brand/40 dark:border-white/15 dark:hover:border-brand/55"
              }`}
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand/8 blur-2xl" />

              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand/25 bg-brand/12 text-brand transition-colors duration-300 group-hover:bg-brand/18">
                <s.icon size={22} aria-hidden="true" />
              </div>

              <span className="block text-3xl font-extrabold leading-none text-foreground sm:text-4xl">{s.value}</span>
              <span className="mt-2 block text-xs font-medium uppercase tracking-[0.06em] text-foreground-secondary sm:text-sm">{s.label}</span>

              <div className="mt-4 h-1 w-16 rounded-full bg-brand/30 transition-all duration-300 group-hover:w-24 group-hover:bg-brand/55" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Repeat ─────────────────────────────────────────────────────────────

function CtaRepeatSection({
  dataAvailable,
  isAuthenticated,
}: {
  dataAvailable: boolean;
  isAuthenticated: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="relative isolate overflow-hidden bg-linear-to-b from-brand/10 via-surface to-surface py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/14 blur-3xl" />
        <div className="absolute -left-10 bottom-8 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -right-10 top-8 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-4 text-center">
        <div className="rounded-3xl border border-strong/55 bg-surface/90 px-6 py-10 shadow-lg backdrop-blur sm:px-10 sm:py-12 dark:border-white/15 dark:bg-white/[0.03] dark:shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
          <div className="mb-5 flex justify-center">
            <Logo variant="lockup" size={28} />
          </div>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-strong/60 bg-surface-subtle px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-foreground-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {t(dataAvailable ? "landing.readyLabel" : "landing.demoMode")}
          </div>

          <h2 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
            {t(dataAvailable ? "landing.ctaHeading" : "landing.demoCtaHeading")}
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-foreground-secondary">
            {t(dataAvailable ? "landing.ctaDescription" : "landing.demoCtaDescription")}
          </p>

          {dataAvailable && (
            <div className="mb-8 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-foreground-secondary">
              <span className="rounded-full border border-strong/60 bg-surface-subtle px-3 py-1">No credit card</span>
              <span className="rounded-full border border-strong/60 bg-surface-subtle px-3 py-1">Fast onboarding</span>
              <span className="rounded-full border border-strong/60 bg-surface-subtle px-3 py-1">Transparent scoring</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {!dataAvailable ? (
              <>
                <ButtonLink href="#service-status" size="lg" className="w-full px-10 sm:w-auto">
                  {t("landing.viewStatus")}
                </ButtonLink>
                <ButtonLink href="/contact" variant="secondary" size="lg" className="w-full px-10 sm:w-auto">
                  {t("layout.contact")}
                </ButtonLink>
              </>
            ) : isAuthenticated ? (
              <ButtonLink
                href="/app"
                size="lg"
                className="w-full px-10 sm:w-auto"
                iconRight={<ChevronRight size={18} aria-hidden="true" />}
              >
                {t("auth.dashboard")}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink
                  href="/auth/signup"
                  size="lg"
                  className="w-full px-10 sm:w-auto"
                  iconRight={<ChevronRight size={18} aria-hidden="true" />}
                >
                  {t("landing.getStarted")}
                </ButtonLink>
                <ButtonLink
                  href="/auth/login"
                  variant="secondary"
                  size="lg"
                  className="w-full px-10 sm:w-auto"
                >
                  {t("landing.signIn")}
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Combined export ────────────────────────────────────────────────────────

export function LandingSections({ dataAvailable = true }: { dataAvailable?: boolean }) {
  const isAuthenticated = useIsAuthenticated(dataAvailable);
  return (
    <>
      {!dataAvailable && <ServiceStatusBanner />}
      <HeroSection dataAvailable={dataAvailable} isAuthenticated={isAuthenticated} />
      <FeaturesSection />
      <HowItWorksSection />
      <DataStatsSection dataAvailable={dataAvailable} />
      <CtaRepeatSection dataAvailable={dataAvailable} isAuthenticated={isAuthenticated} />
    </>
  );
}
