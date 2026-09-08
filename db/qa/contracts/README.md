# Evidence foundation QA contracts

## Execution, diagnostics, and inventory evidence

`RUN_QA.ps1` keeps executed, failed and untested counts separate. Every SQL
execution error or incomplete suite blocks release, including diagnostic suites.
`blocking_failed` and `diagnostic_failed` distinguish release assertions from
historical observations; neither category is erased from the report.

The twelve scoring-distribution queries remain unchanged historical diagnostics.
Their old band proportions do not validate the withdrawn consumer score. Existing
API, evidence, isolation, archive and security-posture suites form the explicit
`consumer_retirement` assessment; each must execute completely and pass.

Only `rls_audit` (seven queries) and `function_security_audit` (six queries) are
reviewed inventories. Their SQL explicitly defers pass/fail assertions to
`QA__security_posture.sql`. They remain `unassessed`, with per-query row counts
and inventory output retained (quoted SQL literals redacted). A missing query,
SQL error or arbitrary suite relabeling cannot pass. Successful inventory
execution is not a completed manual security audit. Overall status stays `warn`
when inventories remain unassessed or diagnostic findings exist; `-FailOnWarn`
can make that warning fatal. The executable security posture contract remains
blocking and loads `evidence_security.sql` in the same session.

`RUN_QA.ps1` loads `evidence_security.sql` into each consuming session before
security posture, scale guardrails, lists/comparisons and the two index suites.
The objects are temporary and never installed by a production migration. When
running one of these suites manually, prepend this file in the same psql session.

Forty-two exact public function signatures are reviewed invoker wrappers. The contract
requires their presence, invoker mode, empty search path,
the specified anonymous/authenticated access, service access and no PUBLIC execution. Additional unreviewed
invokers fail. Four token readers (legacy and v2 list/comparison) have explicit
anonymous capability access; this is not a general anonymous table grant.
The public-share pgTAP suite separately tests token isolation, malformed tokens,
revocation and omission of private IDs/notes. Ingestion tables must retain RLS,
zero policies, no anonymous/authenticated table or column grants, and service
read/write privileges. Other tables retain the policy-presence requirement.

C adds 31 authenticated retirement/read wrappers and one service-only pending
notification wrapper to the B set of ten. Pending notifications must never gain
authenticated execution. Three new Home/Scan definers require owner `postgres`,
empty search path, authenticated/service execution and no PUBLIC/anon execution.
The 27 moved historical implementations in `evidence_private` remain service-only;
this restriction does not apply to the separately reviewed live private helpers
that invoker wrappers need to call. Retired anonymous endpoint names are removed
from the legacy allowlist. B's committed ten-signature contract remains historical.
Seven public historical score/confidence formulas also retain service-only
execution; browser denial does not change their mathematical bodies or types.

The four new ingestion tables use constraint-aware index checks: valid, ready
B-tree key columns must lead with the complete FK column set, or a unique key
subset must bound the lookup to at most one row. Expression and INCLUDE columns
cannot satisfy this requirement. A simple FK-column `IS NOT NULL` predicate is
accepted because FK equality implies it; other partial predicates are unproven.
This avoids a redundant index on `selected_observation_id`: that FK also includes
the unique record ID. A nonunique subset alone does not establish complete
composite-key support.

Legacy tables retain their original index checks and established exemption.
Their nonleading/partial-index cases have not been individually assessed by this
change; they are not declared defects or certified by the new strict contract.

Run the 21 rollback regression/mutation assertions on a disposable B database
with the five manifest migrations and pgTAP already installed. Set
`QA_DISPOSABLE_PORT` to that database's loopback port; use the original managed
`postgres` role and provide its local password through the normal psql mechanism.
From the repository root, the shipped SQL runs directly:

```powershell
$qaSql = "SET search_path=public,extensions;`n" +
  (Get-Content db/qa/contracts/evidence_security.sql -Raw) + "`n" +
  (Get-Content db/qa/contracts/evidence_security.test.sql -Raw)
$qaSql | psql --host=127.0.0.1 --port=$env:QA_DISPOSABLE_PORT --username=postgres --dbname=postgres -X --set=ON_ERROR_STOP=1
```

Require the exact `1..21` plan and 21 `ok` results, with no failed/skipped/TODO
assertions; psql's exit code alone does not interpret pgTAP assertion failures.
The seven previously failing checks also run through their regular QA suites.
Never run these mutation tests against production or a shared database.

For applied C, use the same psql prelude with `evidence_security_c.test.sql` for
13 exact-security/rollback assertions. The existing B index regressions separately
require the final B supporting indexes. A passing C security suite does not
certify the full database QA suite or migration ordering.
