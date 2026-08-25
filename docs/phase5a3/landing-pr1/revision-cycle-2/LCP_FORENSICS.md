# Replacement-candidate mobile LCP forensics

Production source: `6f675ffe8c4091ed98db2f53298fe4acc19f6895`, tree
`e82f1ce3b0f9fdfd8d41f02b04fb8d25a5b81da6`.

The one allowed replacement cohort ran in the pinned Playwright Linux image
`mcr.microsoft.com/playwright:v1.62.1-noble` at digest
`sha256:c091b21d9fae78c76e85cd4356431e9b018402f172a214fc7d7a5e9a7e29d8ac`.
All five mobile samples are retained.

## Result

Mobile LCP is `2821.25`, `2630.71`, `2672.31`, `2612.07`, and
`2617.58 ms`; median is `2630.71 ms` and maximum is `2821.25 ms`.
Every sample exceeds the `2500 ms` ceiling. One sample also records
`262 ms` TBT against the `200 ms` maximum.

## Retained evidence

- The H1 is the LCP element in every sample with the same 354×131 rectangle at
  `top=179`.
- Raw observed H1/FCP paint is only `154–288 ms`.
- Simulated TTFB is `455.54–457.85 ms`.
- Simulated element-render delay is `2156.54–2363.63 ms`.
- Three failing samples report no task over 50 ms in diagnostics.
- The `2821.25 ms` / `262 ms` sample includes a 312 ms shared-chunk task at
  `2572.88 ms`; that outlier is retained, but removing it would not make the
  four remaining LCP samples pass.
- The exact cold landing now has zero console errors, zero unexpected first-party
  4xx responses, zero font requests, and Best Practices 1.00 in every sample.
- The two stylesheet requests remain the only render-blocking suggestion. The
  historical global-inline-CSS trial removed those requests and worsened LCP and
  transfer, so it is not a new causal source.

## Conclusion

This is the previously documented Lighthouse/Lantern cutoff pattern: early observed
paint is transformed into a discrete simulated render-delay cluster. The replacement
source fixes social-preview truth and the Speed Insights 404, but the retained Linux
cohort identifies no new causal source that has not already been rejected.

Per the bounded protocol, no third source experiment or unchanged cohort rerun is
authorized. The engineering disposition remains **REVISE**.
