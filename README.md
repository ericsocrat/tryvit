# TryVit

Food information for everyday shoppers in Poland and Germany.

**Find → inspect recorded facts and limitations → compare compatible quantities
→ save and retrieve products.**

TryVit is invitation-only. It is not a medical-advice service, an allergen-safety
certification, a complete catalog of everything sold locally, or a personal
dietary recommendation system.

## Evidence-first rebuild

The released evidence-first implementation replaces the unsupported weighted
health score with source-linked facts and explicit uncertainty. Historical scores are retained
for audit, not republished as current winners or health outcomes. Implementation
status is not deployment status:

- [Release and verification ledger](docs/implementation/EVIDENCE_FIRST_REBUILD.md)
- [Product, mathematical and source-data policy](docs/EVIDENCE_DATA_POLICY.md)
- [Product positioning and open assumptions](docs/PRODUCT_POSITIONING.md)
- [Current project status](CURRENT_STATE.md)

Nutrition values retain their unit, basis, preparation state and qualifiers.
Missing is not zero; recently retrieved is not package-verified. Recorded fields
must resolve to source observations. Invalid or incompatible evidence withholds
comparison instead of silently producing a reassuring result.

## Architecture

- Next.js / React frontend with shared neutral UI, TypeScript and TanStack Query.
- Supabase/Postgres with server-owned authorization and runtime-validated RPCs.
- Python acquisition and normalization, stable source identity and immutable
  observations, transactional source-owned projections.
- GitHub Actions and the established Vercel deployment path; required checks,
  exact migration manifests, staging validation and scoped recovery evidence.

No additional framework or search service is required for this milestone.

## Development and verification

Read repository instructions and environment setup before running commands.
Use local/staging fixtures for mutation tests; never point a test at real users.
Keep credentials in the approved local environment, never source or reports.

```powershell
cd frontend
npm ci
npx tsc --noEmit
npm run lint
npm run test
```

Guarded browser commands and their runtime requirements live in
[the frontend documentation](frontend/README.md). Production builds and browser
evidence must identify the actual backend/fixture environment. A build alone is
not proof of a deployed working journey.

The frozen source-reconciliation cohort is in
[data-quality/cohorts/evidence-first-v1.json](data-quality/cohorts/evidence-first-v1.json).
Retain every observation and discrepancy. It checks extraction and reconciliation,
not universal food accuracy or validation of a nutrition scoring model.

## Data rights

The repository's [software license](LICENSE) does not replace source licenses.
Open Food Facts database data is ODbL; individual contents and images have their
own applicable terms. Preserve attribution and source-specific notices:
[OFF licensing guidance](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/).
See [the evidence policy](docs/EVIDENCE_DATA_POLICY.md#rights-and-attribution).

## Release boundaries

Preserve user-owned collections, product IDs, historical evidence and recovery
options. Do not enable public signup, disclose credentials or automate a human
verification challenge to make a check pass. The production Turnstile
first-use/replay proof remains unresolved until genuine evidence establishes it.
No static badge or historical test count should be interpreted as current CI,
scientific validity, deployment or launch certification.
