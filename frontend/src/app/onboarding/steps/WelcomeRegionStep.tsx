"use client";

import type { StepProps } from "@/app/onboarding/types";
import styles from "@/app/onboarding/OnboardingExperience.module.css";
import { Button } from "@/components/common/Button";
import { FoldedTryVitIdentity } from "@/components/common/FoldedTryVitIdentity";
import { COUNTRIES, getLanguagesForCountry } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { Check } from "lucide-react";

interface WelcomeRegionStepProps extends StepProps {
  readonly loading?: boolean;
  readonly onSkipAll: () => void;
}

export function WelcomeRegionStep({
  data,
  loading = false,
  onChange,
  onNext,
  onSkipAll,
}: Readonly<WelcomeRegionStepProps>) {
  const { t } = useTranslation();
  const availableLanguages = data.country
    ? getLanguagesForCountry(data.country)
    : [];

  function handleCountrySelect(code: string) {
    const languages = getLanguagesForCountry(code);
    onChange({ country: code, language: languages[0]?.code ?? "en" });
  }

  return (
    <div className={styles.step}>
      <div className={`${styles.stepIntro} ${styles.welcomeIntro}`}>
        <span className={styles.heroMark}>
          <FoldedTryVitIdentity compact size={32} />
        </span>
        <div>
          <h1 className={styles.title}>{t("onboarding.welcomeTitle")}</h1>
          <p className={styles.description}>{t("onboarding.welcomeSubtitle")}</p>
        </div>
      </div>

      <section className={styles.registerSection}>
        <p className={styles.registerCaption} aria-hidden="true">01 / 02</p>
        <h2 className={styles.sectionTitle}>{t("onboarding.regionTitle")}</h2>
        <div className={styles.choiceList}>
          {COUNTRIES.map((country) => {
            const selected = data.country === country.code;
            return (
              <button
                type="button"
                key={country.code}
                onClick={() => handleCountrySelect(country.code)}
                aria-pressed={selected}
                disabled={loading}
                className={`${styles.choiceRow} ${
                  selected ? styles.choiceSelected : ""
                }`}
                data-testid={`country-${country.code}`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {country.flag}
                </span>
                <span className={styles.choiceCopy}>
                  <span className={styles.choiceTitle}>{country.name}</span>
                  <span className={styles.choiceMeta}>{country.native}</span>
                </span>
                {selected ? <Check size={20} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      {data.country && availableLanguages.length > 0 ? (
        <section className={styles.registerSection}>
          <p className={styles.registerCaption} aria-hidden="true">02 / 02</p>
          <h2 className={styles.sectionTitle}>{t("onboarding.languageLabel")}</h2>
          <div className={styles.languageGrid}>
            {availableLanguages.map((language) => {
              const selected = data.language === language.code;
              return (
                <button
                  type="button"
                  key={language.code}
                  onClick={() => onChange({ language: language.code })}
                  aria-pressed={selected}
                  disabled={loading}
                  className={`${styles.choiceTile} ${
                    selected ? styles.choiceTileSelected : ""
                  }`}
                >
                  {language.native}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          onClick={onSkipAll}
          disabled={loading}
          fullWidth
          data-testid="onboarding-skip-all"
        >
          {t("onboarding.skipAll")}
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!data.country || loading}
          fullWidth
          data-testid="onboarding-get-started"
        >
          {t("onboarding.next")}
        </Button>
      </div>
    </div>
  );
}
