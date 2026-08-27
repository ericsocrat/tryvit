# Final review synthesis

Disposition: **REVISE**.

Review authority is production source
`6f675ffe8c4091ed98db2f53298fe4acc19f6895`, tree
`e82f1ce3b0f9fdfd8d41f02b04fb8d25a5b81da6`, with the 67-file replacement packet
sealed at `c07f9f10190bd4f8c1e3c6f6af00fe9460fbaa02`. Candidate-1 opinions and scores
were excluded from all three fresh reviews.

## Independent results

- Reviewer A: **REVISE — 84/100**.
- Reviewer B: **REVISE — 80/100**.
- Non-taste QA: **FAIL**.

## Consensus engineering blockers

All three reviewers independently confirmed:

1. the five-run Linux mobile LCP median is `2630.71 ms`, every sample exceeds
   `2500 ms`, and TBT maximum is `262 ms`;
2. the authoritative 390 px Linux candidate has a severe collision between the
   synthetic-example label and package title;
3. common query-bearing landing entries are classified into the application-provider
   boundary, so the lean-runtime proof applies only to exact queryless `/`.

No third performance experiment, unchanged cohort rerun, threshold waiver, sample
removal, silent recapture, or post-evidence source change is authorized.

## Reviewer disagreement retained

Reviewer B additionally flags the inherited `/app` “Search Products” and “Scan
Barcode” manifest shortcuts as incomplete truth-matrix coverage. Non-taste QA validated
the requested manifest treatment and did not classify those shortcuts as a blocker;
they are unchanged from main and belong to the separately scoped installed application.
This synthesis does not authorize a PWA/scanner change in the landing PR. It retains
the concern for an explicit future application-readiness/PWA decision instead of
hiding it or broadening this PR.

## Human and operational gates

- `TRYVITE` EUTM `018026887` legal/identity decision;
- qualified Polish and German review;
- operational deployment-readiness and kill-switch confirmation;
- branded Safari, qualified screen-reader/voice-control, and physical-device review;
- separately authorized immutable-baseline acceptance.

PR `#1301` must remain draft, open, unapproved, and unmerged. No later route family is
authorized.
