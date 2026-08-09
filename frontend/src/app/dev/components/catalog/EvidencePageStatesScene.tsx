"use client";

import {
  AllergenBadge,
  ConfidenceBadge,
  NovaBadge,
  NutrientTrafficLight,
  NutriScoreBadge,
  ScoreBadge,
} from "@/components/common";

import { CatalogRow, CatalogSection } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

export function EvidencePageStatesScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  return (
    <CatalogSection id="evidence-page-states" title={copy.scenes["evidence-page-states"]}>
      <CatalogRow label="Score bands (1–100)"><ScoreBadge score={10} showLabel /><ScoreBadge score={30} showLabel /><ScoreBadge score={50} showLabel /><ScoreBadge score={70} showLabel /><ScoreBadge score={90} showLabel /><ScoreBadge score={null} /><ScoreBadge score={42} size="sm" /><ScoreBadge score={42} size="md" /><ScoreBadge score={42} size="lg" /></CatalogRow>
      <CatalogRow label="Nutri-Score grades"><NutriScoreBadge grade="A" /><NutriScoreBadge grade="B" /><NutriScoreBadge grade="C" /><NutriScoreBadge grade="D" /><NutriScoreBadge grade="E" /><NutriScoreBadge grade={null} /><NutriScoreBadge grade="B" size="sm" /><NutriScoreBadge grade="B" size="md" /><NutriScoreBadge grade="B" size="lg" /></CatalogRow>
      <CatalogRow label="NOVA groups"><NovaBadge group={1} showLabel /><NovaBadge group={2} showLabel /><NovaBadge group={3} showLabel /><NovaBadge group={4} showLabel /><NovaBadge group={null} /></CatalogRow>
      <CatalogRow label="Confidence"><ConfidenceBadge level="high" percentage={95} /><ConfidenceBadge level="medium" percentage={65} /><ConfidenceBadge level="low" percentage={30} /><ConfidenceBadge level={null} /></CatalogRow>
      <CatalogRow label="Per 100 g"><NutrientTrafficLight nutrient="fat" value={2.5} /><NutrientTrafficLight nutrient="saturates" value={8} /><NutrientTrafficLight nutrient="sugars" value={15} /><NutrientTrafficLight nutrient="salt" value={0.3} /></CatalogRow>
      <CatalogRow label="Allergen status"><AllergenBadge status="present" allergenName="Gluten" /><AllergenBadge status="traces" allergenName="Milk" /><AllergenBadge status="derived" allergenName="Eggs" /><AllergenBadge status="unknown" allergenName="Soy" /><AllergenBadge status="assessed-absent" allergenName="Nuts" /></CatalogRow>
      <article className="catalog-v2-panel" data-testid="living-label-v2-evidence">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{copy.livingLabel}</p>
            <p className="text-sm">Evidence fixture: source record, confidence and explanation are fixed for review.</p>
          </div>
          <span className="catalog-v2-status">Source checked</span>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div><dt>Source</dt><dd className="font-medium">Ingredient panel</dd></div>
          <div><dt>Observed</dt><dd className="font-medium">2026-01-01</dd></div>
          <div><dt>Status</dt><dd className="font-medium">Reviewable</dd></div>
        </dl>
        <p className="text-sm">{copy.fixtureNote}</p>
      </article>
    </CatalogSection>
  );
}
