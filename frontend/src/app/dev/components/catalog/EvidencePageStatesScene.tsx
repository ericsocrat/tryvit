import { Icon, type IconName } from "@/design-system/icons/Icon";
import { PageState, type PageStateStatus } from "@/design-system/patterns/PageState/PageState";
import { Button } from "@/design-system/primitives/Button/Button";
import { Surface } from "@/design-system/primitives/Surface/Surface";

import { CatalogRow, CatalogSection, CatalogSpecimen } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

const scoreValues = [90, 70, 50, 30, 10, null, 58, 58, 58] as const;
const scoreTones = ["score-low", "score-low", "score-moderate", "score-high", "score-high", "neutral", "score-moderate", "score-moderate", "score-moderate"] as const;
const scoreSizes = ["medium", "medium", "medium", "medium", "medium", "medium", "small", "medium", "large"] as const;
const scoreLabelIndices = [0, 1, 2, 3, 4, 5, 2, 2, 2] as const;
const nutriGrades = ["A", "B", "C", "D", "E", "?", "B", "B", "B"] as const;
const nutriSizes = ["medium", "medium", "medium", "medium", "medium", "medium", "small", "medium", "large"] as const;
const novaTones = ["nova-1", "nova-2", "nova-3", "nova-4", "neutral"] as const;
const confidenceTones = ["confidence-high", "confidence-medium", "confidence-low", "neutral"] as const;
const nutritionTones = ["nutrition-low", "nutrition-high", "nutrition-medium", "nutrition-low"] as const;
const allergenTones = ["allergen-contains", "allergen-may-contain", "allergen-derived", "allergen-unknown", "allergen-absent"] as const;
const allergenIcons: readonly IconName[] = [
  "feedback.error",
  "feedback.degraded",
  "evidence.records",
  "help.context",
  "action.confirm",
];
const pageStateStatuses: readonly PageStateStatus[] = [
  "loading",
  "empty",
  "error",
  "offline",
  "degraded",
  "paused",
  "recovering",
];

export function EvidencePageStatesScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  const evidence = copy.evidence;
  const primitives = copy.primitives;
  return (
    <CatalogSection id="evidence-page-states" title={copy.scenes["evidence-page-states"]}>
      <CatalogSpecimen label={copy.specimenLabel} note={copy.specimenNote}>
        <CatalogRow label={evidence.scoreBands}>
          {scoreValues.map((value, index) => (
            <span
              aria-label={`${evidence.scoreBands}: ${value ?? "—"}, ${evidence.scoreLabels[scoreLabelIndices[index]]}`}
              className="catalog-v2-domain"
              data-domain={scoreTones[index]}
              data-size={scoreSizes[index]}
              key={`${value ?? "none"}-${index}`}
              role="img"
            >
              <strong>{value ?? "—"}</strong>
              {index < 6 ? <span>{evidence.scoreLabels[index]}</span> : null}
            </span>
          ))}
        </CatalogRow>

        <CatalogRow label={evidence.nutriScore}>
          {nutriGrades.map((grade, index) => (
            <span
              aria-label={`${evidence.nutriScore}: ${grade}`}
              className="catalog-v2-regulated"
              data-domain={grade === "?" ? "neutral" : `nutri-${grade.toLowerCase()}`}
              data-size={nutriSizes[index]}
              key={`${grade}-${index}`}
              role="img"
            >
              {grade}
            </span>
          ))}
        </CatalogRow>

        <CatalogRow label={evidence.novaGroups}>
          {evidence.novaLabels.map((label, index) => (
            <span
              aria-label={`${evidence.novaGroups}: ${index < 4 ? index + 1 : "?"}, ${label}`}
              className="catalog-v2-regulated"
              data-domain={novaTones[index]}
              key={label}
              role="img"
            >
              <strong>{index < 4 ? index + 1 : "?"}</strong>
              <span>{label}</span>
            </span>
          ))}
        </CatalogRow>

        <CatalogRow label={evidence.confidence}>
          {evidence.confidenceLabels.map((label, index) => (
            <span className="catalog-v2-domain" data-domain={confidenceTones[index]} key={label}>
              <Icon name="evidence.records" size="sm" />
              {label}
            </span>
          ))}
        </CatalogRow>

        <CatalogRow label={evidence.nutrition}>
          {evidence.nutrientLabels.map((label, index) => (
            <span className="catalog-v2-domain" data-domain={nutritionTones[index]} key={label}>
              <span aria-hidden="true" className="catalog-v2-domain-mark" />
              <strong>{label}</strong>
              <span>{evidence.nutritionLevels[index === 1 ? 2 : index === 2 ? 1 : 0]}</span>
            </span>
          ))}
        </CatalogRow>

        <CatalogRow label={evidence.allergenStatus}>
          {evidence.allergenLabels.map((label, index) => (
            <span
              aria-label={`${label}: ${evidence.allergenNames[index]}`}
              className="catalog-v2-domain"
              data-domain={allergenTones[index]}
              key={label}
              role="img"
            >
              <Icon name={allergenIcons[index]} size="sm" />
              <span>{label}</span>
              <strong>{evidence.allergenNames[index]}</strong>
            </span>
          ))}
        </CatalogRow>

        <div className="space-y-3">
          <p className="catalog-v2-row-label text-sm font-medium">{primitives.pageStates}</p>
          <div className="catalog-v2-page-state-grid">
            {pageStateStatuses.map((status, index) => (
              <PageState
                announce="off"
                description={primitives.pageStateDescriptions[index]}
                headingLevel={3}
                key={status}
                primaryAction={status === "error" ? (
                  <Button size="sm">{primitives.retry}</Button>
                ) : undefined}
                secondaryAction={status === "degraded" ? (
                  <Button size="sm" variant="secondary">{primitives.recoveryAction}</Button>
                ) : undefined}
                status={status}
                title={primitives.pageStateTitles[index]}
              />
            ))}
          </div>
        </div>
      </CatalogSpecimen>

      <Surface
        as="article"
        className="catalog-v2-panel"
        data-testid="living-label-v2-evidence"
        layer="raised"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{copy.foundation.livingLabel}</p>
            <p className="catalog-v2-copy text-sm">{evidence.fixtureDescription}</p>
          </div>
          <span className="catalog-v2-status">{evidence.sourceChecked}</span>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div><dt>{evidence.source}</dt><dd className="font-medium">{evidence.sourceValue}</dd></div>
          <div><dt>{evidence.observed}</dt><dd className="font-medium">2026-01-01</dd></div>
          <div><dt>{evidence.status}</dt><dd className="font-medium">{evidence.statusValue}</dd></div>
        </dl>
        <p className="catalog-v2-copy text-sm">{copy.fixtureNote}</p>
      </Surface>
    </CatalogSection>
  );
}
