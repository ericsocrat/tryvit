# Ingredient Enrichment Governance

Phase 4C makes ingredient identity decisions explicit control data before any further category expansion. The registry at `pipeline/enrichment_registry.json` is the only approved alias and quarantine source used by the deterministic enrichment matcher.

## Decision model

Every reviewed token records its raw and normalized forms, canonical identity when one is justified, mapping classification, country/category scope, evidence, review status, allergen and parent-child permissions, and an explanation. Supported classifications are:

- `exact_canonical_match`
- `approved_alias`
- `context_qualified_alias`
- `ambiguous_and_withheld`
- `source_artifact_and_quarantined`
- `unsafe_parent_child_inference_and_withheld`
- `unknown_or_unmatched`

The matcher uses normalized exact identity and reviewed registry entries only. Runtime fuzzy or semantic matching is not permitted.

## Safety invariants

Registry validation fails before generation when mappings overlap contradictorily, a generic token maps globally to a specific identity, scoped mappings can leak, aliases form a cycle, a withheld/artifact entry permits inference, a target is absent from the committed vocabulary, or parent-child rules conflict.

An absent allergen declaration remains unknown. Reports keep explicit `contains`, explicit `may contain`, and deterministic ingredient-derived evidence separate. A derived record is allowed only when a reviewed deterministic ingredient rule supports it; it does not convert missing source evidence into an allergen-free claim.

## Current withheld decisions

- `Starch` remains ambiguous across corn, potato, and wheat sources. Its 23 observed Phase 4B occurrences remain unlinked.
- `Vegetable Oil` remains ambiguous across specific oil identities. Its 4 observed occurrences remain unlinked.
- `Kcal` and `Kcal 0 8` are nutrition-label artifacts and remain quarantined.
- 11 otherwise identifiable child tokens remain withheld because their source parent is ambiguous and cannot support a valid parent-child linkage.

Run `python -m pipeline.governance_report` to regenerate the JSON and Markdown evidence in `data-quality/phase4c`. Use `--check` in CI to detect drift without rewriting files.
