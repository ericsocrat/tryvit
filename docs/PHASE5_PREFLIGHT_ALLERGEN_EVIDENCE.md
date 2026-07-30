# Phase 5 preflight A: allergen evidence semantics

## Purpose

TryVit stores positive allergen evidence. A missing row does not say that an
allergen was assessed and found absent. This preflight makes that distinction
explicit before the Phase 5 experience redesign.

## Previous contract and defect

`product_allergen_info` stored `contains` and `traces` rows but did not identify
whether a positive row came from a source declaration or a deterministic
ingredient rule. The product profile reduced the rows to comma-separated lists.
The product matrix then treated every unmentioned EU-14 allergen as `free`, and
the no-row state as a green all-clear.

The search payload also used the legacy key `allergen_free`. Its actual SQL only
excluded products with a matching `contains` row. Products with a matching
`traces` row, and products with no allergen evidence at all, remained eligible.
The UI nevertheless called the filter “Allergen-Free.” Saved searches persisted
the same misleading wording.

## Evidence contract

`product_allergen_info` remains a positive-evidence table. Its new
`evidence_basis` column has three values:

| Value | Meaning |
| --- | --- |
| `explicit_source` | Positive `contains` or `may contain` evidence supplied by a source declaration. |
| `ingredient_derived` | Positive evidence produced by an approved deterministic ingredient-to-allergen rule. |
| `legacy_unclassified` | Historical positive evidence whose provenance cannot be reconstructed safely. |

Historical rows are deliberately backfilled as `legacy_unclassified`. An older
normalization step copied tag text into `source_tag`, so the mere presence of
`source_tag` is not proof of a source declaration. Current reproducible source
pipelines and derivation steps set the stronger basis explicitly.

There is no assessed-absence row type in this phase. The API exposes
`absence_assessment: "not_assessed"` and an empty `assessed_absent` array.
Authoritative negative evidence can be added later only with a real source and
separate review. Empty arrays, zero counts, null fields, and unmentioned EU-14
allergens all mean evidence is unknown or unavailable.

## API contract

`api_get_product_profile` preserves its existing allergen fields and adds:

- `evidence`: tag, positive evidence type, basis, and source tag;
- `evidence_status`: `positive_evidence_available` or `unknown`;
- `absence_assessment`: currently always `not_assessed`;
- `assessed_absent`: currently always empty.

`api_get_product_allergens` preserves `contains` and `traces` arrays and adds the
same evidence metadata. It returns an explicit unknown payload for requested
products without positive rows instead of silently omitting them.

The legacy `allergen_free` search key remains on the wire for saved-search and
RPC compatibility. Its documented and user-visible meaning is now: **exclude
products declared or deterministically evidenced to contain the selected
allergen**. It does not exclude `may contain` or unknown products, and it does
not certify any returned product as free from the allergen.

`api_get_filter_options` allergen counts likewise mean products with positive
`contains` evidence, not products assessed free from an allergen.

## Presentation contract

The product matrix presents every EU-14 allergen in one of these states:

1. explicit contains evidence;
2. deterministic ingredient-derived evidence;
3. may-contain evidence;
4. evidence unavailable;
5. assessed absent, reserved for a future authoritative contract.

Unmentioned allergens use a neutral unknown treatment. The no-evidence summary
is neutral and never green. Derived evidence remains a positive warning but is
visibly distinguishable from explicit source evidence. English, Polish, and
German use equivalent claims.

Search filters, active chips, and saved-search summaries use “exclude contains
evidence” language. Product exports use “evidence unavailable” instead of
“none” when the data contains no allergen tags.

## Compatibility and security

The profile extension is additive. Existing `contains`, `traces`, and count
fields remain available. Legacy CSV-only frontend payloads remain positive
evidence but render with provenance unavailable. No caller may infer assessed
absence from missing new fields.

The evidence-aware RPCs remain `SECURITY DEFINER`, use a fixed `search_path`,
revoke default public execution, and grant only the established API roles. The
renamed internal profile implementation is not directly executable by API roles
and deliberately does not use the public `api_` naming contract.

## Verification boundary

Tests cover explicit, may-contain, derived, mixed, unknown, and future assessed
absence states; truthful search behavior; saved-filter copy in EN/PL/DE; API
compatibility; idempotent database writes; and neutral no-evidence rendering.
The full local database replay must preserve Phase 4 governance, reports,
thresholds, baselines, and linkage checksums.

This contract requires no hosted Supabase access and makes no remote deployment,
scanner, dependency, or Phase 5 visual-redesign change.
