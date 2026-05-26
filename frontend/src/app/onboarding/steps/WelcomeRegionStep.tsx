"use client";

// ─── Step 1: Welcome + Region ───────────────────────────────────────────────
// Combines greeting with country/language selection in a single step.
// Issue #701: streamline onboarding from 7 steps to 4.

import type { StepProps } from "@/app/onboarding/types";
import { Button } from "@/components/common/Button";
import { COUNTRIES, getLanguagesForCountry } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { Check } from "lucide-react";

interface WelcomeRegionStepProps extends StepProps {
  readonly onSkipAll: () => void;
}

export function WelcomeRegionStep({
  data,
  onChange,
  onNext,
  onSkipAll,
}: Readonly<WelcomeRegionStepProps>) {
  const { t } = useTranslation();
  const availableLanguages = data.country
    ? getLanguagesForCountry(data.country)
    : [];

  function handleCountrySelect(code: string) {
    const langs = getLanguagesForCountry(code);
    const defaultLang = langs[0]?.code ?? "en";
    onChange({ country: code, language: defaultLang });
  }

  return (
    <div className="space-y-8">
      <div className="mb-4 text-center text-5xl">🍎</div>

      <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
        {t("onboarding.welcomeTitle")}
      </h1>
      <p className="mb-8 text-center text-sm text-foreground-secondary">
        {t("onboarding.welcomeSubtitle")}
      </p>

      {/* Region title */}
      <section className="rounded-2xl border border-border bg-surface-subtle/60 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t("onboarding.regionTitle")}
        </h2>

        <div className="space-y-3">
          {COUNTRIES.map((country) => (
            <button
              type="button"
              key={country.code}
              onClick={() => handleCountrySelect(country.code)}
              aria-pressed={data.country === country.code}
              className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/45 ${
                data.country === country.code
                  ? "border-brand bg-brand-subtle"
                  : "border bg-surface hover:border-strong"
              }`}
              data-testid={`country-${country.code}`}
            >
              <span className="text-3xl">{country.flag}</span>
              <div>
                <p className="font-semibold text-foreground">{country.name}</p>
                <p className="text-sm text-foreground-secondary">
                  {country.native}
                </p>
              </div>
              {data.country === country.code && (
                <span className="ml-auto text-brand">
                  <Check size={20} />
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Language selector */}
      {data.country && availableLanguages.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface-subtle/60 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground-secondary">
            {t("onboarding.languageLabel")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {availableLanguages.map((lang) => (
              <button
                type="button"
                key={lang.code}
                onClick={() => onChange({ language: lang.code })}
                aria-pressed={data.language === lang.code}
                className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/45 ${
                  data.language === lang.code
                    ? "border-brand bg-brand-subtle font-medium text-brand"
                    : "border text-foreground-secondary hover:border-strong"
                }`}
              >
                <span>{lang.native}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onSkipAll}
          className="flex-1"
          data-testid="onboarding-skip-all"
        >
          {t("onboarding.skipAll")}
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!data.country}
          className="flex-1"
          data-testid="onboarding-get-started"
        >
          {t("onboarding.next")}
        </Button>
      </div>
    </div>
  );
}
