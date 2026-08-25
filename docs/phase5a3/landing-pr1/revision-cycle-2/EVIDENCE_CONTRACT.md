# Revision-cycle-2 evidence contract

## Source and commit layering

Production source is frozen at
`14c8b19fc7aa59f58811ef96989291e2b3893bfe`, tree
`251c6622f14ebfbf170882d33dafe326509da2a8`. All production-source media and
performance evidence binds to that SHA.

`ab0a43ecfcfbb064553a02a722263fda07b06ae8` changes only
`frontend/e2e/smoke-responsive.spec.ts` so the generic smoke contract recognizes
the deliberately composed two-level header. It does not alter a production file or
invalidate the source-bound cohort.

Any later production-file change invalidates this packet and requires a new source
freeze, full media regeneration, a new five-sample cohort, Route-JS comparison, and
fresh review.

## Capture matrix

The packet contains:

- 13 original-resolution PNG stills: EN light/dark at 390, 768, and 1440; 320 reflow;
  640 effective-viewport proxy; forced colors; PL text spacing; DE dark; and EN
  no-JavaScript light/dark;
- two EN/demo VP8 WebM recordings at a 390×844 page viewport;
- one complete normal/reduced motion ledger;
- one decoded-frame/video validation ledger;
- EN/PL/DE × live/demo machine-readable truth, privacy, metadata, and JSON-LD evidence;
- Chromium geometry measurements at 320, 390, 768, and 1440;
- Firefox and WebKit behavior with normal/reduced motion and JavaScript on/off;
- exactly five raw landing LHRs and one guarded metadata file per mobile/desktop
  profile;
- the complete stable Route-JS artifact and summary;
- two-pass Linux candidate and determinism artifacts;
- one SHA-256/byte manifest covering every evidence file except the manifest itself.

The theme control retains an honest disabled `noscript` fallback. The section links
themselves remain visible and actionable without JavaScript.

## Performance policy

Exactly one frozen candidate was measured. Every valid sample is retained. There was
no outlier removal, unchanged retry, threshold change, or infrastructure
reclassification.

Acceptance remains:

- mobile performance ≥0.90; desktop ≥0.95;
- mobile LCP median ≤2400 ms and every sample ≤2500 ms;
- TBT ≤200 ms; CLS ≤0.05; TTFB ≤800 ms;
- cold transfer ≤900 KiB; font transfer 0;
- no motion-attributable task over 50 ms;
- landing Route-JS ≤184,320 gzip bytes;
- unchanged +10 KiB or +5% Route-JS regression guard.

## Immutability

Revision cycle 1 remains at its original path and tree. Accepted Phase 5A.0d
production baselines, manifest, masks, tolerances, and workflow policy are unchanged.
Linux images in this packet are candidates only.

## Review boundary

After the evidence seal, two fresh reviewers receive the Phase 5A.3 rubric, production
candidate, and cycle-2 packet without cycle-1 scores or one another’s work. A separate
non-taste QA review checks hashes, bytes, clipping, overlap, media completeness,
readiness state, localization state, mobile destination coverage, and baseline
immutability.

Automated review does not close the legal, qualified PL/DE, branded Safari,
assistive-technology, or physical-device gates.

