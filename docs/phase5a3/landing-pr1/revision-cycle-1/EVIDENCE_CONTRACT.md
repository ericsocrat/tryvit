# Evidence contract

## Source binding and history

Every replacement artifact is bound to source
`64f015ee8be3a929c2239b7aa94abcac7e36aaa1` and tree
`4b3d17f8918392b7e375c6fbd1e2518a7ecdb66c`. The predecessor source
`1f7ad2c0e52833f06a3d17e010ad653b366ee291`, evidence seal `f0674a59`, media,
performance files, Linux candidates, and review records remain in their original paths.
`evidence/predecessor-and-change.json` binds both packet identities.

The evidence-seal commit may follow the production source. It may contain only this
replacement packet and handoff records; no production source may change after the
bound source without a new freeze and complete regeneration.

## Required local media

The manifest must contain exactly:

- 13 original-resolution PNG stills: EN light/dark at 390, 768, and 1440; 320 reflow;
  640 effective-viewport proxy; forced colors; PL text spacing; DE dark; and EN no-JS
  light/dark;
- two named VP8 WebM recordings at a 390×844 page viewport;
- one `landing-motion-performance.json` with both complete journeys;
- one `video-validation.json` proving complete decode, frame counts, dimensions,
  durations, no black segment, footer coverage, terminal focus, and non-truncated ends.

Playwright's two auto-video intermediates were byte-identical to the named saved files
and were excluded from staging. No duplicate or unexpected media entered the packet.

## Complete motion journey

Normal and reduced motion use the same ordered checkpoints:

1. first viewport;
2. dark-theme change without scroll movement;
3. package disclosure without scroll movement across the interaction;
4. Evidence;
5. Method;
6. Trust;
7. final action;
8. complete footer;
9. terminal keyboard focus on Demo mode.

The observer window begins before navigation and ends after the terminal hold. It
retains every layout shift, long task, CSS animation interval, and transition interval,
then classifies interval overlaps. Both modes require CLS ≤0.05, zero
motion-attributable layout shift, and no motion-attributable task above 50 ms.

## Lighthouse

Exactly five raw landing LHRs and the guarded metadata file are committed for each of
mobile and desktop. Selection is by exact requested URL, not filename order. Every raw
LHR has byte count and SHA-256 in `performance.json`, along with:

- exact LCP element and rectangle;
- simulated TTFB, resource delay/duration, and element-render delay;
- observed raw LCP phases;
- main-thread breakdown and tasks above 20 ms;
- CSS dependencies and zero font requests;
- performance, accessibility, best-practices, SEO, LCP, TBT, CLS, TTFB, and transfer.

No valid sample may be removed. The final pass/fail result is computed independently of
the repository's lower general public Lighthouse floor.

## Route JavaScript and Linux candidates

Route-JS evidence is the four-file artifact from run `32857250390`. It requires
`harnessSource: pr-base`, regression enforcement, base `61c52e73`, and head `64f015ee`.
Thresholds remain `+10 KiB` or `+5%`.

The complete seven-image candidate artifact and compact two-pass determinism artifact
from manual run `32858309119` are retained. The three landing candidates are proposals
only. Immutable production baselines remain unchanged in PR `#1301`.

## Limitations

- Chrome DevTools MCP could not run because no stable Chrome executable was installed.
- The 640 CSS-pixel capture is an effective-viewport proxy, not literal branded zoom.
- No branded Safari, screen-reader, camera, or physical-device approval is claimed.
- Browser automation is not qualified PL/DE review or legal clearance.
