"use client";

import styles from "@/app/onboarding/OnboardingExperience.module.css";
import type { StepProps } from "@/app/onboarding/types";
import { Button } from "@/components/common/Button";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { FOOD_CATEGORIES, HEALTH_GOALS } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";

interface GoalsCategoriesStepProps extends StepProps {
  readonly loading?: boolean;
}

export function GoalsCategoriesStep({
  data,
  loading = false,
  onChange,
  onNext,
  onBack,
}: Readonly<GoalsCategoriesStepProps>) {
  const { t } = useTranslation();

  function toggleGoal(value: string) {
    const healthGoals = data.healthGoals.includes(value)
      ? data.healthGoals.filter((goal) => goal !== value)
      : [...data.healthGoals, value];
    onChange({ healthGoals });
  }

  function toggleCategory(slug: string) {
    const favoriteCategories = data.favoriteCategories.includes(slug)
      ? data.favoriteCategories.filter((category) => category !== slug)
      : [...data.favoriteCategories, slug];
    onChange({ favoriteCategories });
  }

  return (
    <div className={styles.step}>
      <div className={styles.stepIntro}>
        <p className={styles.registerCaption} aria-hidden="true">03 / 03</p>
        <h1 className={styles.title}>{t("onboarding.healthGoalsTitle")}</h1>
        <p className={styles.description}>{t("onboarding.healthGoalsSubtitle")}</p>
      </div>

      <section className={styles.registerSection}>
        <div className={styles.goalList}>
          {HEALTH_GOALS.map((goal) => {
            const selected = data.healthGoals.includes(goal.value);
            return (
              <button
                type="button"
                key={goal.value}
                onClick={() => toggleGoal(goal.value)}
                aria-pressed={selected}
                disabled={loading}
                className={`${styles.goalRow} ${
                  selected ? styles.goalSelected : ""
                }`}
                data-testid={`goal-${goal.value}`}
              >
                <span className={styles.choiceTitle}>{t(goal.labelKey)}</span>
                <span className={styles.choiceMeta}>{t(goal.descKey)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.registerSection}>
        <p className={styles.registerCaption} aria-hidden="true">02 / 02</p>
        <h2 className={styles.sectionTitle}>{t("onboarding.categoriesTitle")}</h2>
        <p className={styles.sectionDescription}>{t("onboarding.categoriesSubtitle")}</p>

        <div className={styles.categoryGrid}>
          {FOOD_CATEGORIES.map((category) => {
            const selected = data.favoriteCategories.includes(category.slug);
            return (
              <button
                type="button"
                key={category.slug}
                onClick={() => toggleCategory(category.slug)}
                aria-pressed={selected}
                disabled={loading}
                className={`${styles.categoryChoice} ${
                  selected ? styles.categorySelected : ""
                }`}
                data-testid={`category-${category.slug}`}
              >
                <CategoryIcon slug={category.slug} size="md" />
                <span>{t(category.labelKey)}</span>
              </button>
            );
          })}
        </div>
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
        <Button
          type="button"
          onClick={onNext}
          loading={loading}
          fullWidth
          data-testid="onboarding-complete"
        >
          {loading ? t("onboarding.saving") : t("onboarding.finish")}
        </Button>
      </div>
    </div>
  );
}
