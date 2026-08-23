# Checkpoint 2 finite evidence contract

> **Status:** Frozen before mass capture
> **Evidence class:** Review-only; never a production baseline

The matrix is finite and source-controlled before mass capture. A real defect may add
focused rejected/replacement evidence, but cannot silently broaden or weaken this
contract.

## Required retained evidence

| Evidence | Count | Contract |
|---|---:|---|
| Core stills | 36 | Six references × 390/768/1440 × light/dark |
| Polish mobile stills | 6 | One representative 390px light state per reference |
| Long-German desktop stills | 6 | One representative 1440px dark state per reference |
| Forced-colors stills | 6 | One meaningful state per reference |
| State/recovery contact sheets | 6 | Every finite state and recovery for one reference |
| Normal-motion recordings | 6 | One complete deterministic journey per reference |
| Reduced-motion recordings | 6 | Same journey and information at the 0ms endpoint |
| Asset boards | 7 | Identity, lockups, compact/favicon, maskable, social/OG, typography, glyphs |

Behavioral coverage also runs at 320, 390, 768, 1024, 1280, and 1440; 200% zoom;
WCAG text spacing; coarse/fine pointer; hover/no-hover; selected RTL-sensitive
composites; and targeted Chromium/Firefox/WebKit journeys. These behavioral cases do
not create an uncontrolled screenshot Cartesian product.

## Source and safety binding

Every retained file records exact source SHA/tree, runtime/browser identity,
dimensions, locale, theme, motion mode, state, bytes, and SHA-256. The verifier rejects
missing or extra paths, symlinks/reparse points, non-regular files, local paths,
credentials, hosted identifiers, invalid PNG/WebM contents, blank/uniform first frames,
prepaint, truncated endings, and mismatched manifest bytes.

The raw matrix belongs in GitHub Actions artifacts. The committed review packet is
limited to `15 MiB` and contains only essential stills, contact sheets, complete
recordings, boards, and the exact manifest. Rejected evidence is retained under a
versioned rejection namespace; replacement evidence is generated only from a new exact
source SHA after a causal correction.

## Performance evidence

Each reference retains every valid sample and reports median and range for LCP, TBT,
CLS, and TTFB plus JS/CSS/font/image bytes and long tasks. Thresholds remain LCP
≤2.5s, TBT ≤200ms, landing CLS ≤0.05 and never >0.1, TTFB ≤800ms, no
animation-attributable task >50ms, no animation-caused layout shift, fonts ≤100 KiB,
and no production Route-JS regression by either +10 KiB gzip or +5%.

The conservative production evidence remains `/app` mobile `0.83` against `0.85` with
the retained `538ms` TBT sample. The later stable `0.87` observation is retained but
does not erase debt. The landing `0.65` outlier remains visible. Review-environment lab
results are not production Core Web Vitals.
