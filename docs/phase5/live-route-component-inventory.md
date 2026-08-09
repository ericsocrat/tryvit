# Phase 5A.1a live route/component inventory

`live-route-component-inventory.json` is a deterministic snapshot of current production
TypeScript/TSX modules beneath `frontend/src/app`, `frontend/src/components`, and
`frontend/src/design-system`. It is separate from the historical
`route-component-inventory.json`, which remains unchanged.

Generate the snapshot from `frontend`:

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/design-system/phase5a1a-live-inventory-cli.mts
```

The snapshot records the stable `merge-base HEAD origin/main` and a SHA-256 fingerprint
of the scanned source graph and debt data, but never a self-referential commit SHA or a
timestamp. Modules are sorted by repository-relative path and record static, resolvable
local imports and their inverse consumers using the TypeScript parser. A `use client`
value is true only for an explicit directive in the JavaScript directive prologue.

The `visualDebtRatchets` entries are path/value/count maxima for `.card`, `.input-field`,
arbitrary Tailwind shadow/radius/duration/animation/tracking values, and `transition-all`.
Checks fail for a newly observed category, path, value, or increased count; a removed or
lower-count occurrence passes.
