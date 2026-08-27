# Source and artifact inventory

## Production source boundary

Bound source: `64f015ee8be3a929c2239b7aa94abcac7e36aaa1`, tree
`4b3d17f8918392b7e375c6fbd1e2518a7ecdb66c`.

Production changes cover:

- `frontend/src/app/page.tsx`, `HomePageContent.tsx`, and `LandingSections.tsx`;
- `frontend/src/app/_landing-v2/**`;
- the lean request-provider boundary in `src/proxy.ts`, `src/app/layout.tsx`, and the
  design-system skip control split;
- deferred live public auth initialization;
- source/title/route-marker/accessibility contracts and smoke tests;
- regenerated `docs/phase5/live-route-component-inventory.json`.

No package/lockfile, Supabase migration, API, scanner, authenticated route, service
worker, icon, social-image route, or immutable visual baseline changed.

## Replacement evidence

- 13 PNG stills in `evidence/stills`.
- 2 named WebM recordings in `evidence/motion`.
- Complete-journey motion ledger and video validation.
- 10 raw final landing LHRs plus 2 guarded metadata files.
- Final performance, all trial cohorts, runtime, CI/security, and predecessor ledgers.
- Full four-file Route-JS artifact plus summary.
- Full seven-image Linux candidate artifact, two-pass determinism artifact, and summary.
- `evidence/manifest.json` with byte count and SHA-256 for every staged file.

## Historical evidence

The original packet under `docs/phase5a3/landing-pr1/evidence` and the original
`reviews/initial` and `reviews/final` files remain byte-for-byte in place. They are not
rewritten as if they reviewed the replacement source.

Fresh replacement reviews live only under `revision-cycle-1/reviews`.
