/**
 * Metadata required before a custom TryVit domain glyph can enter the registry.
 * Phase 5A.1b intentionally ships no new identity or domain artwork.
 */
export type DomainGlyphSemanticName = `domain.${Lowercase<string>}`;

export type DomainGlyphImplementationPath =
  | `frontend/src/design-system/icons/domain/${string}.tsx`
  | `frontend/public/icons/domain/${string}.svg`;

interface DomainGlyphMetadata {
  readonly semanticName: DomainGlyphSemanticName;
  /** Controlled repository path used by the icon registry implementation. */
  readonly implementationPath: DomainGlyphImplementationPath;
  readonly source: string;
  readonly license: string;
  readonly sha256: string;
}

interface DomainGlyphReviewFlags {
  readonly forcedColorsReviewed: boolean;
  readonly alignedTo24PixelGrid: boolean;
}

export type DomainGlyphDefinition = DomainGlyphMetadata &
  (
    | {
        readonly status: "candidate";
        readonly review: DomainGlyphReviewFlags;
      }
    | {
        /** Identity approval is explicitly deferred beyond Phase 5A.1b. */
        readonly status: "phase-5a.2-approved";
        readonly review: {
          readonly forcedColorsReviewed: true;
          readonly alignedTo24PixelGrid: true;
        };
      }
  );

export const domainGlyphRegistry = Object.freeze(
  {} satisfies Readonly<
    Partial<Record<DomainGlyphSemanticName, DomainGlyphDefinition>>
  >,
);

export type DomainGlyphName = keyof typeof domainGlyphRegistry;
