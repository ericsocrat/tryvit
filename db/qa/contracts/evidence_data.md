# C evidence data QA

`evidence_data.sql` snapshots canonical product projections into temporary local
tables once per suite. The runner wraps the six data suites in rollback and
refuses hosted PostgreSQL, implicit service/connection-string routing and remote
Docker before running database or Python checks. These are local QA tools, not
production diagnostics. No missing quantity, score, grade or verification state
is filled to satisfy a population threshold.

Current checks require retired/null aggregate scores, all nine explicit nutrient
fields, truthful recorded-field counts, valid source/product/selected-observation
links, source-equal quantities, and classifications supported by accepted selected
observations. Missing and conflicting values cannot be coerced to zero. Legacy
numbers retain unknown basis and unverified state. Source evidence is explicitly
not package verification.

Absolute mass bounds apply only to recorded exact quantities with proven
per100g basis; relative comparisons require a shared known basis, preparation and
observation. Per100ml, serving and unknown quantities cannot inherit100g caps.
The comparison coverage denominator is reported: zero eligible quantities does
not certify the unexamined quantities. Historical score range/equality and MV
consistency checks remain operator audits; MV staleness is not repaired here.

Coverage and seven old energy/category screening heuristics appear under
`evidence_coverage` in the JSON report, never as verification quotas. Legacy
verified/high-confidence populations, ingredient coverage and small categories
can legitimately be zero. Screening heuristics do not establish physical errors.

The report uses `check_profile: evidence-first-v2`. Executed counts for these
data suites are integrity25, consistency24, quality31, confidence14, nutrition13
and multi-country16. Integrity now counts every query and includes the two image
guards previously excluded by the broad summary truncation. Nutrition removes
seven heuristic gates instead of replacing them with filler PASS checks. The
Views metadata also matches education's16 actual checks. Counts are not comparable
to the old778-check profile as if their meanings were unchanged.

For a disposable applied C database with pgTAP installed, prepend
`evidence_data.sql`, set `search_path=public,extensions`, then execute
`evidence_data.test.sql`. Require the exact20-test plan, all20 passing assertions,
and no skips/TODOs. Tests mutate only synthetic temporary projections and roll
back. They cover invented zero/score/count/source/classification, mixed basis,
preparation, observation and qualifier comparisons.
