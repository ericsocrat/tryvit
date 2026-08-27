# Source and artifact inventory

## Production source

The production freeze changes only the landing route family and its existing
server-only metadata contract:

- `frontend/src/app/page.tsx` and `HomePageContent.tsx`;
- `frontend/src/app/LandingSections.tsx`;
- `frontend/src/app/_landing-v2/copy.ts`, `LandingPublicShell.tsx`,
  `PackageLabelNarrative.tsx`, and `landing.module.css`;
- `frontend/src/app/layout.tsx` and `frontend/src/lib/site-metadata.ts` for localized
  server-only WebApplication JSON-LD;
- focused unit/browser contracts and Playwright project registration;
- the governed live-route component inventory.

No package, lockfile, font, API, database, Supabase migration, RLS, scanner, PWA,
service-worker, authenticated-route, or immutable-baseline file changed.

The source commit contains 20 changed files: 9 production files, 1 generated
inventory, and 10 focused test/config files. The following test-only commit changes one additional
generic smoke file and no production code.

## Evidence artifacts

- 13 PNG stills under `evidence/stills/`;
- 2 VP8 WebMs under `evidence/motion/`;
- capture-build, motion, video, geometry, cross-browser, truth/metadata, runtime,
  performance, CI/security, predecessor/change, and comparison ledgers;
- 10 raw landing LHRs plus 2 guarded run metadata files;
- base/head Route-JS reports, provenance, comparison, and summary;
- seven-image Linux candidate artifact, two deterministic ledgers/manifests, and
  compact summary;
- `evidence/manifest.json` with byte count and SHA-256 for every staged evidence
  file.

## Historical evidence

Cycle 1 remains unchanged under
`docs/phase5a3/landing-pr1/revision-cycle-1/`. The original predecessor packet and
reviews outside that directory also remain unchanged. Cycle-2 reviewers are stored
only under `revision-cycle-2/reviews/` after the evidence seal.
