import type {
  DomainGlyphDefinition,
  DomainGlyphImplementationPath,
  DomainGlyphSemanticName,
} from "./domain-glyph-contract";

type Expect<T extends true> = T;
type Phase5A2ApprovedGlyph = Extract<
  DomainGlyphDefinition,
  { status: "phase-5a.2-approved" }
>;

export type DomainGlyphSemanticNamespaceContract = Expect<
  "feedback.error" extends DomainGlyphSemanticName ? false : true
>;

export type DomainGlyphRepositoryPathContract = Expect<
  "https://example.com/icon.svg" extends DomainGlyphImplementationPath
    ? false
    : true
>;

export type DomainGlyphApprovalNameContract = Expect<
  Extract<DomainGlyphDefinition, { status: "approved" }> extends never
    ? true
    : false
>;

export type DomainGlyphApprovalReviewContract = Expect<
  Phase5A2ApprovedGlyph["review"] extends {
    readonly forcedColorsReviewed: true;
    readonly alignedTo24PixelGrid: true;
  }
    ? true
    : false
>;
