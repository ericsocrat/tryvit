"use client";

import { Badge, Card, Chip, ProgressBar } from "@/components/common";

import { CatalogRow, CatalogSection } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

export function FoundationsScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  return (
    <CatalogSection id="foundations" title={copy.scenes.foundations}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card variant="default"><p className="font-medium">Default</p><p className="text-sm text-foreground-secondary">Standard card with border</p></Card>
        <Card variant="elevated"><p className="font-medium">Elevated</p><p className="text-sm text-foreground-secondary">Card with shadow</p></Card>
        <Card variant="outlined"><p className="font-medium">Outlined</p><p className="text-sm text-foreground-secondary">Stronger border, no shadow</p></Card>
      </div>
      <CatalogRow label="Badges"><Badge variant="info">Info</Badge><Badge variant="success" dot>Active</Badge><Badge variant="warning">Warning</Badge><Badge variant="error">Error</Badge><Badge variant="neutral">Neutral</Badge><Badge size="sm">Small</Badge><Badge size="md">Medium</Badge></CatalogRow>
      <CatalogRow label="Chips"><Chip variant="default">Default</Chip><Chip variant="primary">Primary</Chip><Chip variant="success">Success</Chip><Chip variant="warning">Warning</Chip><Chip variant="error">Error</Chip><Chip interactive onClick={() => {}}>Clickable</Chip><Chip onRemove={() => {}}>Removable</Chip></CatalogRow>
      <div className="max-w-md space-y-3"><ProgressBar value={25} variant="brand" showLabel /><ProgressBar value={50} variant="success" showLabel /><ProgressBar value={75} variant="warning" showLabel /><ProgressBar value={90} variant="error" showLabel /><ProgressBar value={60} variant="score" size="lg" showLabel /></div>
      <article className="catalog-v2-panel" data-testid="living-label-v2-foundation">
        <div>
          <p className="font-semibold">{copy.livingLabel}</p>
          <p className="text-sm">Ingredient transparency fixture · stable source · reviewable context</p>
        </div>
        <div className="catalog-v2-swatches" aria-label="Living Label semantic color roles">
          <div className="catalog-v2-swatch" data-tone="canvas">Canvas</div>
          <div className="catalog-v2-swatch" data-tone="surface">Surface</div>
          <div className="catalog-v2-swatch" data-tone="action">Action</div>
          <div className="catalog-v2-swatch" data-tone="evidence">Evidence</div>
        </div>
        <p className="text-sm">{copy.fixtureNote}</p>
      </article>
    </CatalogSection>
  );
}
