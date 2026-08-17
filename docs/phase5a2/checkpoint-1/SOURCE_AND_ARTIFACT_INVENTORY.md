# Checkpoint 1 source and artifact inventory

> **Last updated:** 2026-08-17  
> **Status:** Exact capture map

## Provenance anchors

- Source commit and tree: exact values in the final regenerated manifest
- Fixture SHA-256: `6914a31758740013d31c07c9d1414b43a6de3b81acb35e0041b548adaddb5074`
- Capture-contract SHA-256, UTF-8/LF canonicalized:
  `22c1ebfd06de10be807900ce502ea9c659ae81bbed3e637c8209d7779ed3313d`
- Binary bytes: 3,089,855
- Package bytes including manifest: 3,112,982

## Authored candidate sources

- `frontend/src/app/dev/phase5a2/_directions/source-fold/SourceFold.tsx`
- `frontend/src/app/dev/phase5a2/_directions/source-fold/source-fold.module.css`
- `frontend/src/app/dev/phase5a2/_directions/evidence-register/EvidenceRegister.tsx`
- `frontend/src/app/dev/phase5a2/_directions/evidence-register/evidence-register.module.css`
- `frontend/src/app/dev/phase5a2/_directions/open-core/OpenCore.tsx`
- `frontend/src/app/dev/phase5a2/_directions/open-core/open-core.module.css`

## Shared review implementation

- Guarded route, layout, and gate under `frontend/src/app/dev/phase5a2/`
- Route/query contract, frozen fixture, localized messages, and review frame under
  `frontend/src/app/dev/phase5a2/_shared/`
- Bounded client islands: `MotionStudy.client.tsx`, `ProductLookup.client.tsx`, and
  `ScannerStudy.client.tsx`

## Verification and generation

- Behavior: `frontend/e2e/phase5a2-direction-behavior.spec.ts`
- Stills: `frontend/e2e/phase5a2-direction-selection-stills.spec.ts`
- Motion: `frontend/e2e/phase5a2-direction-selection-motion.spec.ts`
- Scanner: `frontend/e2e/phase5a2-direction-selection-scanner.spec.ts`
- Capture contract and runner:
  `frontend/tooling/design-system/direction-selection/`
- Static contracts:
  `frontend/tests/phase5a2-direction-selection.test.tsx`,
  `frontend/tests/phase5a2-direction-behavior-contract.test.ts`, and
  `frontend/tests/phase5a2-evidence-hardening.test.ts`

## Generated package

| Kind | Count | Location |
|---|---:|---|
| Candidate stills | 21 | `evidence/stills/` |
| Motion/scanner recordings | 6 | `evidence/motion/` |
| All-candidate contact sheets | 7 | `evidence/contact-sheets/` |
| Manifest | 1 | `evidence/manifest.json` |
| **Total** | **35** | `evidence/` |

The manifest is the authoritative per-file inventory and records SHA-256, bytes,
dimensions, route state, locale/theme/motion metadata, and video structure. `runtime.json`
was verified during candidate generation and folded into manifest runtime fields; it is
not a 36th staged file.

## Authored versus generated boundary

The evidence directory is generated and must not be hand-edited. These handoff Markdown
files are authored adjacent to it and are not included in the 35-file package. Pending
review scorecards and synthesis are also authored decision records, not capture output.
