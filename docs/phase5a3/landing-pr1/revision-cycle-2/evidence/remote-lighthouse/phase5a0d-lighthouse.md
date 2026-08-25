# Phase 5A.0d Lighthouse report

Status: **FAIL** (lab-only; INP and field CWV unavailable)

| Route | Profile | Perf | A11y | BP | SEO | LCP ms | CLS med/max | TBT ms | TTFB ms | Transfer KiB |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| landing | public/mobile | 0.96 | 1 | 1 | 1 | 2643.3 | 0/0 | 119 | 26.3 | 254.2 |
| login | public/mobile | 0.95 | 1 | 0.96 | 1 | 2913.7 | 0/0 | 63.5 | 24.6 | 367.8 |
| contact | public/mobile | 0.95 | 1 | 0.96 | 1 | 2832.3 | 0/0 | 44.5 | 17.9 | 306.5 |
| landing | public/desktop | 1 | 1 | 1 | 1 | 584.9 | 0/0 | 5 | 18.8 | 254.2 |
| login | public/desktop | 1 | 1 | 0.96 | 1 | 684.9 | 0/0 | 0 | 18 | 367.9 |
| contact | public/desktop | 1 | 1 | 0.96 | 1 | 637.9 | 0/0 | 0 | 16.9 | 307.1 |
| app-shell | local-authenticated/mobile | 0.85 | 1 | 0.96 | 1 | 4201.5 | 0/0 | 116 | 138.1 | 410.8 |
| product-detail | local-authenticated/mobile | 0.88 | 0.96 | 0.96 | 1 | 3491.4 | 0/0 | 175 | 122.4 | 456.7 |
| app-shell | local-authenticated/desktop | 1 | 1 | 0.96 | 0.92 | 812 | 0/0 | 0 | 105.5 | 492.3 |
| product-detail | local-authenticated/desktop | 0.99 | 0.96 | 0.96 | 1 | 884.8 | 0/0 | 0 | 130.6 | 496.4 |

## Blocking failures

- None

## Instability failures

- local-authenticated/mobile/app-shell:performance-score-range-above-0.1

## Directional blueprint debt

- public/mobile/landing:blueprint:lcp-median-above-2500ms
- public/mobile/login:blueprint:lcp-median-above-2500ms
- public/mobile/contact:blueprint:lcp-median-above-2500ms
- local-authenticated/mobile/app-shell:blueprint:lcp-median-above-2500ms
- local-authenticated/mobile/product-detail:blueprint:lcp-median-above-2500ms

Report checksum: `f257f8aa9c3c2adcbe07ba5c9b3e446f052b1c8c337bff262f5abb29d917f50b`
