# Phase 5A.1a live route/component inventory

`live-route-component-inventory.json` is a deterministic snapshot of current production
TypeScript/TSX modules beneath `frontend/src/app`, `frontend/src/components`, and
`frontend/src/design-system`. It is separate from the historical
`route-component-inventory.json`, which remains unchanged.

Generate the snapshot from `frontend`:

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/design-system/phase5a1a-live-inventory-cli.mts
```

Schema v2 records the stable `merge-base HEAD origin/main` and SHA-256 fingerprints,
but never a self-referential commit SHA or timestamp. Modules use ordinal sorting by
repository-relative path. The TypeScript parser records static imports/exports and
literal dynamic imports, their inverse direct consumers, and the route modules that
transitively consume each module through the complete production `frontend/src` static
graph. The report remains bounded to modules in its three declared source roots, while
an edge may name an intervening production module elsewhere in `frontend/src`. The
route reachability is dependency evidence; it does not pretend that Next.js layout
nesting is an import edge or expand into the whole-product route-by-state ledger
reserved for later phases.

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
Design System V2 foundations are retained in 5A.1a; common primitives and the mixed
catalog target 5A.1b; production public/auth/share/system, shell, discovery, evidence,
personal, scanner, and closure work target 5A.3 through 5F. Phase 5A.2 intentionally has
no production-module target because it is the non-production Golden Reference Gate.
Unused/unreached production modules go to 5F closure rather than becoming an untracked
deferral. Removal always requires explicit approval and replacement/consumer closure.

The `visualDebtRatchets` entries are path/value/count maxima for `.card`, `.input-field`,
arbitrary Tailwind shadow/radius/duration/animation/tracking values, and `transition-all`.
Checks fail for a newly observed category, path, value, or increased count; a removed or
lower-count occurrence passes. The generator validates against the existing committed
report before writing, so regeneration cannot silently expand the ratchet. The same
classifications are attached to each matching TypeScript/TSX module as
`classifiedLegacyDebt`; CSS occurrences remain represented in the repository-wide
ratchets.
