# Phase 5 live route/component inventory

`live-route-component-inventory.json` is a deterministic snapshot of current production
TypeScript/TSX modules beneath `frontend/src/app`, `frontend/src/components`, and
`frontend/src/design-system`. It is separate from the historical
`route-component-inventory.json`, which remains unchanged.

Generate the snapshot from `frontend`:

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/design-system/phase5a1a-live-inventory-cli.mts
```

Schema v3 records the stable `merge-base HEAD origin/main` and SHA-256 fingerprints,
but never a self-referential commit SHA or timestamp. The generator resolves that base
offline from the explicit CI PR-base SHA, fetched `origin/main`, or local `main`, verifies
that it belongs to the checkout, and reads the comparison report with `git show`. The
mutable worktree JSON is only an output target and can never authorize its own provenance
or debt maxima. Modules use ordinal sorting by
repository-relative path. The TypeScript parser records static imports/exports and
literal dynamic imports, their inverse direct consumers, and the route modules that
transitively consume each module through the complete production `frontend/src` static
graph. The report remains bounded to modules in its three declared source roots, while
an edge may name an intervening production module elsewhere in `frontend/src`. The
route reachability is dependency evidence; it does not pretend that Next.js layout
nesting is an import edge or expand into the whole-product route-by-state ledger
reserved for later phases.

The separate `compatibilityFacadeAudit` is symbol-aware. It distinguishes an actual
runtime import of `Button`, `Card`, `ConfirmDialog`, `EmptyState`, `InfoTooltip`, or the
grandfathered V1 `Icon` bridge from unrelated exports that happen to share the
`components/common` barrel. Each facade entry records the exact direct modules and the
routes that transitively consume those modules. This prevents a file-level barrel edge
from authorizing speculative compatibility facades.

The boundary fields distinguish an explicit `use client` entry, a module reachable from
one of those entries through runtime imports, and a server-only module. A `use client`
value is true only for an explicit directive in the JavaScript directive prologue. The
separate `runtimeBoundaryAudit` scans production TypeScript/TSX below `frontend/src` and
fails closed when a non-type local runtime import resolves into `frontend/tooling`,
`frontend/e2e`, `frontend/tests`, `frontend/docs`, or repository `docs`. Its fingerprint
covers the inspected file/import graph and the ordered violation set; a healthy report
contains zero violations.

Every module also carries its target redesign phase or phases, current `v1`/`v2`/`mixed`
status, disposition, migration gate, removal gate, and path-local classified legacy debt.
Design System V2 tokens, foundations, and accessibility contracts are retained in
5A.1a; canonical primitives, icons, patterns, V1 compatibility facades, and the mixed
catalog target 5A.1b; production public/auth/share/system, shell, discovery, evidence,
personal, scanner, and closure work target 5A.3 through 5F. Phase 5A.2 intentionally has
no production-module target because it is the non-production Golden Reference Gate.
Unused/unreached production modules go to 5F closure rather than becoming an untracked
deferral. Removal always requires explicit approval and replacement/consumer closure.

The `visualDebtRatchets` entries are path/value/count maxima for `.card`, `.input-field`,
arbitrary Tailwind shadow/radius/duration/animation/tracking values, and `transition-all`.
Checks fail for a newly observed category, path, value, or increased count; a removed or
lower-count occurrence passes. The generator validates against the independently read
Git-base report before writing, while PR and exact-main/nightly unit jobs retain the Git
history required to verify both current and historical provenance. Editing the generated
report and source together therefore cannot silently expand the ratchet. The same
classifications are attached to each matching TypeScript/TSX module as
`classifiedLegacyDebt`; CSS occurrences remain represented in the repository-wide
ratchets.

Schema v3 also records the five fixed V1 common-to-facade source relocations. During
generation, only those named destination paths are normalized back to their historical
path maxima; counts are aggregated, so keeping both copies or increasing any value still
fails. The generated module records remain honest about the new `compat-v1` paths. This
permits verified render- and behavior-equivalent source ownership to move without turning a
verified relocation into newly blessed visual debt.

## Phase 5A.1b snapshot

The deterministic Phase 5A.1b graph contains 393 governed modules: 87 route modules,
43 app-support modules, 196 shared-component modules, and 67 design-system modules. It
classifies 209 explicit client entries, 86 client-reachable modules, and 98 server-only
modules. Thirty-nine canonical V2 icon, pattern, and primitive modules have zero
transitive consumers outside the guarded `/dev/components` catalog; production routes
continue to consume V1 or the five exact V1 facades plus the existing Icon bridge.

The complete runtime-boundary scan inspected 498 production modules and found zero
forbidden imports. The report records six symbol-aware compatibility entries and five
fixed source relocations. Running the generator twice produced the identical file
SHA-256 `e09f65f65cad12428f378650fdc8b3695a3f982e2d42b243965f5e143376ee95`.
Its governed source fingerprint is
`724bf1476d9e39cddc376d72cda19a2e0b040ad6a712f94a0a81877e11f3abe3`, its
runtime-boundary fingerprint is
`ebae29e594f02adc4d04bd87b1c30268ce3a32fe06c6db6ae84c98fdc9ecc363`, and its
facade-audit fingerprint is
`4daf94084e2480085c91b0ffe0f0b5f392ca80062874ac8f8a1b8be578ec5332`.
