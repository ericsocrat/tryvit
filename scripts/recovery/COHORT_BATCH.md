# Remaining retained-cohort extension

This core module has no direct production transport or automatic approval.
The separately reviewed `COHORT_PRODUCTION_OPERATOR.md` now describes the
fixed-recipient wrapper and combined recovery prerequisite. No cloud operation,
new source fetch, new role, GitHub workflow, commit or push was performed here.
The original pilot operator, its receipts and all 60 source artifacts are retained.

## Exact review plan

`node scripts/recovery/cohort-batch.mjs` reads cached evidence and returns the
plan summary. `--write-plan` additionally creates the deterministic local review
artifact under `audit-reports/recovery/remaining-cohort-review-<sha256>.json`.

Current manifest SHA256:
`d38750d840b852c8fedde9c5ed1dd1dca6ee24e2d0550298de0a35018018e40f`.
It contains 35 other unchanged candidates and 19 explicit name/brand change
candidates, excluding pilot 178. Each entry binds the existing product ID,
market/EAN, original observation and payload hashes, exact old/new attributes,
extractor/source URL/license and original revision/retrieval/update dates.
The pinned original production plan and retained receipt must still agree on
every record hash. `reviewStatus` remains `pending-root-review`; local rehearsal
does not fabricate a production approval.

The exact held set remains 628, 2882, 2903, 2950 and 6029. The first four require
explicit category/policy decisions; 6029 collides with source-name product 6013.
Cached identity facts were checked 2026-09-08 08:51:26 +02:00 and have not been
refreshed against production by this work.

## Reusable batch engine

`reviewSelection` requires the exact current manifest digest, 1–5 unique eligible
IDs and excludes held/pilot IDs. Selected entries are sorted by country/source
identity. `applyReviewedBatch` receives an injected session factory and durable
store; it opens one transaction per product, stops on the first failure and
reports unattempted members. The provided envelope store is restricted to
`isolated-clone` and uses existing private ACL, AES-GCM, DPAPI and fsync primitives.

Each transaction locks the product, nutrition, provenance and source-owned rows.
It checks the fresh identity and exact reviewed old attributes, other matching
identities, source ownership, independent field assertions and numeric revision/
microsecond time ordering. Missing input is not an empty declaration. It invokes
the existing ingestion function; identity, all nutrient fields, selected lineage,
ingredient/allergen sets and unaffected row hashes must then match.

A matching already-selected observation returns `ALREADY_SELECTED_NO_WRITE`
after rechecking its projections. A retained but withdrawn observation cannot
be silently selected again. Existing different source revisions require a new
reviewed refresh manifest; this version covers the retained initial population.

Each transaction's unaffected fingerprint excludes only its own member's
product/source/batch. Every peer remains protected, including members of the
same reviewed batch, so an accidental peer write fails before COMMIT. Batch
completion additionally rechecks every member's exact target postimage.

Reversal checks the exact durable target postimage under the same locks. It restores
only prior projections, source-owned assertions and selection, preserving
immutable observations/batches/mappings. Every independent legacy junction row
remains in the unaffected fingerprint scope. Every other batch member is also
included in that scope; final peer postimage checks add coverage. A global
fingerprint from an earlier batch is not a lifetime lock on unrelated products:
reversal allows unrelated changes since capture, then requires that current
unaffected fingerprint to remain identical across the reversal itself. Target
identity, stored rows, source selection, assertions, observations and read model
must still match the exact durable postimage. Technical product/nutrition timestamps advance, while
numeric text preserves decimal precision/scale and canonical read models return
to their exact prior values.

## Populated public-source recovery profile

`cohort-public-recovery.mjs` adds a separate adapter profile,
`observations-public-cohort-v1`; it does not weaken existing empty-only recovery.
It accepts only the approved retained public OFF records, exact known columns,
accepted immutable observations, known single-record batch identities, exact
source metadata, selected references and complete source-assertion contents.
It rejects unknown/private payload additions, extra or missing IDs, unexpected
sources/URLs, timestamp or hash drift, quarantined records and broken closure.

`proposedPublicAllowlist` creates a pending-review manifest of exact source-row
IDs/digests and source evidence. `validatePublicAllowlist` requires its reviewed
digest and exact current row equality. `approvedSnapshotDumpArgs` additionally
requires an active read-only repeatable-read transaction and binds the 21-table
dump arguments to that same exported snapshot. It does not run production
pg_dump or certify a backup. Existing catalog privacy checks, encrypted storage,
full schema recovery and final production release proof still need integration.

## Actual local evidence and limits

`cohort-batch-rehearsal.mjs` restores the real 17-table baseline with the seven
consumer migrations, then exercises three candidates: unchanged PL 195, renamed
PL 148 and renamed DE 2041. It tests apply, no-write repeated calls, source-owned
sets, reverse-order rollback, exact canonical restoration and rejection of
withdrawn-selection retries. It creates a populated allowlist for 3 batches,
3 mappings, 3 immutable observations and 20 source assertions and rejects
adversarial URL/reference/batch-identity changes.

`cohort-populated-clone-archive.mjs` actually exports those 21 tables from the
same verified clone snapshot, encrypts/fsyncs/reopens the archive using DPAPI,
restores it into a second database inside the same contained disposable clone,
and compares every table's full-row fingerprint. It excludes the proven-null
Auth reviewer FK, RLS, triggers, RPC execution and storage objects from that
data-archive proof. No populated production recovery is claimed.

The rehearsal receipt records exact source hashes. Five focused unit tests also
cover manifest membership/review scope, changed identities, recovery closure,
private/unexpected rows and read-only snapshot requirements. The real three-
member test does not establish successful extraction/import for all 54 members.
Before production, root review, fresh identity/provenance checks, integrated
populated recovery proof and an explicitly approved bounded operator remain
required. Current cached review facts must never be relabelled fresh production
verification.

`--all54` now requests all eligible members in eleven batches of at most five,
with simultaneous selected-state archive verification followed by full reverse
order rollback. It does not widen the operator's maximum-five batch scope.
`--product-ids` is a bounded local diagnostic selector; `--retain-selected` is
an explicit full-cohort clone-only mode, not production authorization.

The full-cohort caller explicitly requests a 1,200-second contained database
lifetime. All existing callers retain the 300-second default, and the helper
accepts only those two fixed bounds. Network isolation, roles, memory, mounts
and logging restrictions are unchanged. The previous full run reached the
five-minute watchdog (exit124, not OOM), exposing an unhandled stdin EPIPE;
transport errors now reject pending/later queries without retry. A failed or
uncertain COMMIT is still a HOLD requiring reconciliation.

The expanded rehearsal exposed nondeterministic ingredient-name casing in the
larger cohort before any remote execution. Root corrected the ambiguous C5
DISTINCT tie with a final raw-name C-collation tie-break, preserving recorded
source priority. Earlier failures and the old three-member PASS remain evidence
for their own source versions, not substitutes for the full run below.

## Remaining remote integration boundary

The smallest later production integration is an authenticated injected SQL
session plus the existing durable encrypted-envelope store, not a public API
or new database role. It must bind environment/project, exact source and
migration hashes, fresh scoped recovery receipt, reviewed cohort digest and
the explicitly chosen maximum-five IDs before each batch. Fresh identity,
ownership, timestamp and projection checks remain inside each transaction.
Uncertain commits require read-only envelope reconciliation, never an automatic
retry. A populated production backup must combine the existing seventeen-table
privacy/schema/authority restore with the exact reviewed public-source allowlist
and twenty-one-table snapshot/archive/restore proof; the clone data-only archive
does not independently certify Auth, RLS, triggers, functions or storage.

Earlier three-member passing receipt:
`audit-reports/recovery/cohort-batch-rehearsal-1788869058349.json` at source HEAD
`904bd2c501584a4eca3e3b871e7b381d694c3d45`. The batch engine SHA256 is
`20aae9743e8051e2c176e7f80f0af634f62324023dd82129209ddfd32fece081`.
The receipt contains hashes for every other executable extension module and
the exact populated source/restored fingerprint equality. Earlier receipts
remain immutable evidence for their own earlier source hashes.

## Full54 clone certification

`audit-reports/recovery/cohort-batch-rehearsal-1788872358008.json` is PASS at
source HEAD `56dd971622a90d17ce91818aee8f2d74fbb4aa53` plus the exact uncommitted
operator/helper hashes recorded in that receipt. The consumer migration digest
is `f2f164f0e669f310fcf480eae89b4f6d09ead69fa8d0ee2e3acfe27b2bdcf048`.

All54 candidates applied in eleven batches of at most five; every duplicate
returned no-write, every final peer postimage matched, and all54 subsequently
reversed in reverse order with canonical models restored and immutable history
retained. Withdrawn-selection retries were rejected. The former global-CAS
predicate was demonstrated to reject legitimate later-batch changes; target-only
CAS plus within-transaction unaffected equality passed the full reversal.

The simultaneously selected population contained54 batches,54 source mappings,
54 immutable observations and502 assertions. All21 tables were exported from
the same reviewed read-only snapshot, encrypted/fsynced/reopened, actually
restored, and compared using full-row fingerprints. Source and restore digest:
`01a85c5badffcdf1f039a048bf2041bdab612fb6f759c6b3560f2f7b817f6373`.
The held five and pilot178 were outside every selected scope. There were no
remote reads/writes, production approvals, Git commits or pushes. This is still
a clone data-archive proof, not populated production recovery certification.

### Stronger per-transaction peer protection

Root review identified that excluding all batch peers let a unit-test injected
peer write reach COMMIT before the final peer check. The test reproduced that
acceptance, then passed after restricting each transaction's exclusion to its
own product/source/batch. Final peer checks remain as additional protection.

The new full54 run is PASS:
`audit-reports/recovery/cohort-batch-rehearsal-1788873701824.json`.
Engine SHA256:
`3311602c159f8aa64c8c188a6974ab0c9d6b689c37d2c31fb5c817630f67eb83`.
It repeats all54 applies, duplicates and reversals in eleven bounded batches,
retains all54 observations, and verifies the selected54/502-assertion archive.
All21 source/restored table fingerprints match:
`03f97df9edfe5bcccef573a236e6603cbd9e628fc6972c3e3c05fa31c5aa2fc5`.
The earlier full54 receipt remains unchanged evidence for the earlier guard.
The new receipt pins startHEAD56dd plus all nine executable hashes and the same
consumer/cohort manifest hashes; unrelated consumer-copy commits during the run
are not asserted to be identical whole-tree source.
