# Evidence-first product and data policy

Policy: `evidence-first-v1`. Contract version: `2`.
Implementation and deployment status are tracked separately in
[the release ledger](implementation/EVIDENCE_FIRST_REBUILD.md).

## Product contract

TryVit helps everyday shoppers in Poland and Germany find a product, inspect its
recorded facts and limitations, compare compatible quantities, and keep useful
products in their own collections. It does not establish medical suitability,
allergen absence, overall safety or an overall healthiest product.

The existing logo, authentication boundaries, product identifiers and user-owned
collections remain. The old weighted score is not a dependency of this release.
Historical calculations are preserved, not relabelled as current recommendations.
No change in a model or its availability means a food became healthier.

## Why the aggregate was retired

The legacy SQL function returned an unhealthiness value of 4 with all nullable
inputs missing; its consumer inversion produced 96/100. This is a reproduced
function behavior, not an assertion that every catalog product lacked nutrition.
The catalog snapshot had nutrition rows but no field-level provenance.

Even a corrected missing-input fallback would not validate the construct:

- Project weights and ceilings do not establish health-outcome predictions.
- Total sugars are not the same measurement as dietary free sugars.
- Product concentration is not daily intake or an individual's exposure.
- Additive count, processing classifications and ingredient concern can overlap.
- A regulatory concentration expressed per fat mass is not per total food mass.
- Display precision and numerical reproducibility are not scientific validity.

The replacement is intentionally not another formula. WHO describes healthy
dietary patterns in terms of adequacy, balance, moderation and diversity, with
individual context. That guidance does not validate the former TryVit weighting.
[WHO healthy-diet guidance](https://www.who.int/news-room/fact-sheets/detail/healthy-diet).
EFSA evaluates additive substances and dietary exposure; the former project
0–3 concern labels must not be attributed to EFSA as its universal risk scale.
[EFSA food-additive assessment](https://www.efsa.europa.eu/en/topics/topic/food-additives).

Future aggregate work needs a defined construct, independent domain review,
data eligibility rules, a versioned specification, adversarial/sensitivity
analysis and a reversible release. Until then, the consumer score is explicitly
`retired` with `value: null`; no implicit positive fallback or winner is allowed.

## Source observations and projection

`ingestion_batches` records source, market, scope and extractor version.
`product_source_records` maps source + external identity + market to a stable
product ID. `product_source_observations` retains immutable selected or
quarantined observations, sanitized raw input, extraction, transformation
metadata and hashes. The selected observation projects source-owned facts.

Normal ingestion is a partial upsert, never a whole-category replacement.
Absence from a batch cannot retire a product, clear another market's barcode or
remove saved references. Ambiguous identity is quarantined. Explicit identity
reconciliation is a separate bounded operation with a manifest and rollback.

Ingredient and allergen assertions are replaced transactionally only within their
owning source when the source actually reports the set. Missing input is not an
empty declaration. Retained older positives keep their original observation IDs;
independent legacy assertions remain visibly unverified.
Combined ingredients are not presented as an ordered package ingredient list.

Hashes establish snapshot consistency and repeatability, not food truth.
Open Food Facts is a source of product observations, not independent verification
of today's physical package. Source contradictions remain visible and prevent
comparison. Newer quarantined observations cannot silently clear old warnings.

## Numeric and evidence semantics

Values retain decimal strings until display; explicit zero differs from missing.
Normalization preserves `eq/lt/lte/gt/gte/approx`, measurement unit, basis and
preparation state. No density is guessed; grams are not silently converted to ml.
OFF's nutrient `_100g` fields may mean per 100 ml for liquids. Where the retrieved
metadata does not establish the distinction, the basis stays unknown.
[OFF nutrition schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/).

States: recorded, unverified, missing, invalid and conflicting. Recorded means a
field resolves to a retained source observation, not package-verified or certain.
Retrieval time, source update time and field completeness are separate facts.
No field count or source priority is advertised as a probability of correctness.
Unknown ingredients cannot establish vegan/vegetarian suitability; missing
allergen data cannot establish absence or safety.

The v2 read model validates source references and data shape at runtime.
Comparison uses exact decimal arithmetic only for recorded values with resolved
sources, equal units, a known matching per-100-g/ml basis, matching known
preparation and exact qualifiers. Unknown, per-serving without a common
quantity, qualified or conflicting evidence withholds the arithmetic.
A lower recorded amount never establishes an overall healthier product.
Source-reported Nutri-Score and NOVA retain attribution; unknown model versions
remain unknown. They are not silently recomputed or endorsed as TryVit findings.

## Reconciliation, migration and recovery

The frozen 60-product PL/DE cohort is an extraction/reconciliation test, not a
representative estimate of factual accuracy. Keep all members, snapshots and
discrepancies; distinguish model effects from source updates.
Unrecoverable historical fields stay unverified instead of receiving invented
provenance. Quarantined observations do not mutate the selected projection.

Use additive migrations, exact migration hashes, staging validation and a
verified recovery receipt before production data repair. A catalog-data restore
does not prove Auth, RLS, functions, triggers or storage-object restoration.
Receipt scope must match the change; preserve user data and avoid schema
contraction. Roll back only to a compatible evidence-first reader, never to a
build that converts missing values into favorable scores.

## Rights and attribution

Source rights are separate from the project software license. OFF's database is
ODbL, individual database contents use the Database Contents License, and product
images use Creative Commons Attribution ShareAlike with potentially additional
packaging rights. Retain source URLs and the applicable notices; do not apply
TryVit's non-commercial software notice to third-party data or images.
[OFF licensing guidance](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/).

This records the upstream terms, not legal certification of every future reuse,
redistribution or combined database. New distribution arrangements must be
checked against the actual licenses rather than inferred from API availability.
