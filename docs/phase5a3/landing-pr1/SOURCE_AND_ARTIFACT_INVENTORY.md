# Source and artifact inventory

## Authored production source

- `frontend/src/app/page.tsx` — server metadata and landing entry.
- `frontend/src/app/HomePageContent.tsx` — server locale/copy composition without the
  public auth provider.
- `frontend/src/app/LandingSections.tsx` — server-rendered journey.
- `frontend/src/app/_landing-v2/copy.ts` — final EN/PL/DE landing copy.
- `frontend/src/app/_landing-v2/LandingIdentity.tsx` — code-native Source Fold mark,
  path wordmark, lockups, and domain glyphs.
- `frontend/src/app/_landing-v2/LandingPublicShell.tsx` — route-local header/footer.
- `frontend/src/app/_landing-v2/LandingThemeToggle.client.tsx` — client island 1.
- `frontend/src/app/_landing-v2/PackageLabelNarrative.client.tsx` — client island 2.
- `frontend/src/app/_landing-v2/landing.module.css` — route-local layout, color, motion,
  reflow, dark, reduced-motion, and forced-color system.

## Authored verification and governance source

- Four Phase 5A.3 Playwright specifications, six dedicated projects, one guarded review
  command, and the minimal visual-safety launcher opt-in.
- Updated landing unit/server/page contracts and one new source-bound landing contract.
- Existing smoke expectations updated only where the intentional landing content or
  route-local shell changed.
- Two Phase 5A.2 source-contract tests now stop parsing at the explicit Phase 5A.3
  project boundary; their expected Phase 5A.2 counts are unchanged.
- Roadmap, changelog, documentation index, evidence ledgers, legal screen, baseline
  strategy, validation record, and review records.

`frontend/package.json` adds only `phase5:landing-review`. `package-lock.json` and all
dependencies are unchanged.

## Generated artifacts

- `docs/phase5/live-route-component-inventory.json` — repository generator output for
  the current production module graph.
- 13 PNG stills — Playwright screenshot output.
- 2 VP8 WebM recordings — Playwright screencast output.
- `evidence/landing-motion-performance.json` — measured browser observation.
- 3 authoritative Linux landing candidate PNGs — byte-identical two-pass workflow
  artifact subset retained for Eric's baseline review.

## Derived evidence ledgers

- `evidence/manifest.json` — SHA-256 and byte ledger for all generated media plus the
  motion observation.
- `evidence/performance.json` — retained Lighthouse samples, ranges, medians, and
  resource-type transfer.
- `evidence/rejected-font-performance.json` — rejected Manrope/Source Serif trial.
- `evidence/runtime.json` — local runtime and exact-source provenance.
- `evidence/linux-candidate.json` — accepted-baseline/candidate hashes, renderer,
  determinism, artifact IDs, and non-authoritative raw-difference diagnostics.

These JSON ledgers are assembled from deterministic tool output and reviewed as authored
evidence; they are not application runtime assets.

## Intentionally absent

- no production WOFF2 or copied font-license files;
- no raster hero media, stock imagery, or generated illustration;
- no favicon, PWA icon, global social image, immutable baseline, workflow, API,
  database/RLS, Supabase migration, scanner, authenticated route, provider, service
  worker, or hosted-config change.
