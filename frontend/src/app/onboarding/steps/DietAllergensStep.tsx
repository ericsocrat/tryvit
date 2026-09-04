"use client";

import styles from "@/app/onboarding/OnboardingExperience.module.css";
import type { StepProps } from "@/app/onboarding/types";
import { Button } from "@/components/common/Button";
import { ALLERGEN_TAGS, DIET_OPTIONS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";

interface DietAllergensStepProps extends StepProps {
  readonly loading?: boolean;
}

export function DietAllergensStep({
  data,
  loading = false,
  onChange,
  onNext,
  onBack,
}: Readonly<DietAllergensStepProps>) {
  const { t } = useTranslation();

  function toggleAllergen(tag: string) {
    const allergens = data.allergens.includes(tag)
      ? data.allergens.filter((allergen) => allergen !== tag)
      : [...data.allergens, tag];
    onChange({ allergens });
  }

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <h1 className={styles.title}>{t("onboarding.dietTitle")}</h1>
        <p className={styles.description}>{t("onboarding.dietSubtitle")}</p>
      </div>

      <section className={styles.registerSection}>
        <div className={styles.optionGrid}>
          {DIET_OPTIONS.map((option) => {
            const selected = data.diet === option.value;
            return (
              <button
                type="button"
                key={option.value}
                onClick={() => onChange({ diet: option.value })}
                aria-pressed={selected}
                disabled={loading}
                className={`${styles.choiceTile} ${
                  selected ? styles.choiceTileSelected : ""
                }`}
                data-testid={`diet-${option.value}`}
              >
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>

        {data.diet !== "none" ? (
          <div className={styles.toggleStack}>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={data.strictDiet}
                disabled={loading}
                onChange={(event) => onChange({ strictDiet: event.target.checked })}
              />
              <span>{t("onboarding.strictDiet")}</span>
            </label>
          </div>
        ) : null}
      </section>

      <section className={styles.registerSection}>
        <h2 className={styles.sectionTitle}>{t("onboarding.allergenTitle")}</h2>
        <p className={styles.sectionDescription}>{t("onboarding.allergenSubtitle")}</p>

        <div className={styles.allergenGrid}>
          {ALLERGEN_TAGS.map((allergen) => {
            const selected = data.allergens.includes(allergen.tag);
            return (
              <button
                type="button"
                key={allergen.tag}
                onClick={() => toggleAllergen(allergen.tag)}
                aria-pressed={selected}
                disabled={loading}
                className={`${styles.allergenChoice} ${
                  selected ? styles.allergenSelected : ""
                }`}
                data-testid={`allergen-${allergen.tag}`}
              >
                {t(allergen.labelKey)}
              </button>
            );
          })}
        </div>

        {data.allergens.length > 0 ? (
          <div className={styles.toggleStack}>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={data.strictAllergen}
                disabled={loading}
                onChange={(event) =>
                  onChange({ strictAllergen: event.target.checked })
                }
              />
              <span>{t("onboarding.strictAllergen")}</span>
            </label>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={data.treatMayContain}
                disabled={loading}
                onChange={(event) =>
                  onChange({ treatMayContain: event.target.checked })
                }
              />
              <span>{t("onboarding.treatMayContain")}</span>
            </label>
          </div>
        ) : null}
      </section>

      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={loading}
          fullWidth
        >
          {t("onboarding.back")}
        </Button>
        <Button type="button" onClick={onNext} disabled={loading} fullWidth>
          {t("onboarding.next")}
        </Button>
      </div>
    </div>
  );
}
