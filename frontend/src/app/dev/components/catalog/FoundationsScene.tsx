import type { CSSProperties } from "react";

import { CardLink } from "@/design-system/primitives/CardLink/CardLink";
import { IconButton } from "@/design-system/primitives/IconButton/IconButton";
import { Surface } from "@/design-system/primitives/Surface/Surface";

import { CatalogRow, CatalogSection, CatalogSpecimen } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

const feedbackTones = ["info", "success", "warning", "error", "neutral"] as const;
const chipTones = ["neutral", "action", "success", "warning", "error", "info", "neutral"] as const;
const progressTones = ["action", "success", "warning", "error", "evidence"] as const;
const progressValues = [25, 50, 75, 90, 60] as const;

export function FoundationsScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  const foundation = copy.foundation;
  const primitives = copy.primitives;
  return (
    <CatalogSection id="foundations" title={copy.scenes.foundations}>
      <CatalogSpecimen label={copy.specimenLabel} note={copy.specimenNote}>
        <CatalogRow label={primitives.surfaces}>
          <Surface as="article" className="catalog-v2-surface" layer="base">
            <p className="font-semibold">{foundation.cardDefault}</p>
            <p className="catalog-v2-copy text-sm">{foundation.cardDefaultDescription}</p>
          </Surface>
          <Surface as="article" className="catalog-v2-surface" layer="raised">
            <p className="font-semibold">{foundation.cardRaised}</p>
            <p className="catalog-v2-copy text-sm">{foundation.cardRaisedDescription}</p>
          </Surface>
          <Surface
            as="article"
            boundary="strong"
            className="catalog-v2-surface"
            layer="overlay"
          >
            <p className="font-semibold">{foundation.cardOutlined}</p>
            <p className="catalog-v2-copy text-sm">{foundation.cardOutlinedDescription}</p>
          </Surface>
          <CardLink.Root className="catalog-v2-card-link" data-catalog-probe="card-link">
            <div>
              <p className="font-semibold">{primitives.cardLinkTitle}</p>
              <p className="catalog-v2-copy text-sm">{primitives.cardLinkDescription}</p>
            </div>
            <CardLink.Primary href="#evidence-page-states-title">
              {primitives.cardLinkAction}
            </CardLink.Primary>
            <CardLink.Actions>
              <IconButton
                icon="evidence.records"
                label={primitives.cardLinkSecondaryAction}
                size="sm"
                variant="secondary"
              />
            </CardLink.Actions>
          </CardLink.Root>
        </CatalogRow>

        <CatalogRow label={foundation.feedback}>
          {feedbackTones.map((tone, index) => (
            <span className="catalog-v2-tone" data-tone={tone} key={tone}>
              {copy.feedbackLabels[index]}
            </span>
          ))}
        </CatalogRow>

        <CatalogRow label={foundation.chips}>
          {copy.chipLabels.map((label, index) => (
            <span className="catalog-v2-chip" data-tone={chipTones[index]} key={label}>
              {label}
            </span>
          ))}
        </CatalogRow>

        <div className="max-w-md space-y-3">
          <p className="catalog-v2-row-label text-sm font-medium">{foundation.progress}</p>
          {progressValues.map((value, index) => (
            <div className="catalog-v2-progress-group" key={value}>
              <div
                aria-label={`${foundation.progress}: ${value}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={value}
                className="catalog-v2-progress"
                role="progressbar"
              >
                <span
                  className="catalog-v2-progress-fill"
                  data-tone={progressTones[index]}
                  style={{ "--catalog-progress": `${value}%` } as CSSProperties}
                />
              </div>
              <span className="catalog-v2-muted text-xs">{value}%</span>
            </div>
          ))}
        </div>
      </CatalogSpecimen>

      <Surface
        as="article"
        className="catalog-v2-panel"
        data-testid="living-label-v2-foundation"
        layer="raised"
      >
        <div>
          <p className="font-semibold">{foundation.livingLabel}</p>
          <p className="catalog-v2-copy text-sm">{foundation.foundationDescription}</p>
        </div>
        <section className="catalog-v2-swatches" aria-label={foundation.swatchesLabel}>
          <div className="catalog-v2-swatch" data-tone="canvas">{foundation.canvas}</div>
          <div className="catalog-v2-swatch" data-tone="surface">{foundation.surface}</div>
          <div className="catalog-v2-swatch" data-tone="action">{foundation.action}</div>
          <div className="catalog-v2-swatch" data-tone="evidence">{foundation.evidence}</div>
        </section>
        <p className="catalog-v2-copy text-sm">{copy.fixtureNote}</p>
      </Surface>
    </CatalogSection>
  );
}
