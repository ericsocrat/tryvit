# Phase 5A.3 landing-governance prerequisite

> **Integration PR:** `#1302`
> **Base authority:** `3f1c11f6d46fc1fd58a67c9c7be8296e8fdb345a`
> **Scope:** Base-owned Route-JS landing identity and public metadata truthfulness only

## Purpose

Draft landing PR `#1301` cannot be judged by the existing trusted Route-JS harness
because that base-owned harness identifies `/` through retired English hero copy. The
root metadata also advertises instant, science-driven health scoring when the existing
deployment-readiness contract can place public product data in demo/paused mode.

This prerequisite corrects those two causes before `#1301` is rebased. It does not
approve the landing redesign, accept a visual baseline, adopt identity or fonts, or
migrate another route.

## Stable landing identity

The current landing owns one nonvisual marker:

```html
<main id="main-content" data-route-id="public-landing">
```

The trusted measurement contract requires:

- exact loopback origin and pathname `/`;
- empty query and fragment;
- exactly one `data-route-id` anywhere in the document;
- exact value `public-landing`;
- the unique marker attached to `main#main-content`.

Missing, wrong, duplicate, wrong-boundary, redirected, and near-match-route identities
fail closed. Heading text, translation, CSS classes, and button labels are not route
identity. Existing login, contact, authenticated-shell, product-fixture, safety,
teardown, report, and checksum contracts remain unchanged.

The +10 KiB **or** +5% Route-JS regression limits remain exactly unchanged. The
prerequisite PR itself is judged by the old PR-base harness on both revisions; after the
prerequisite merges, the new harness becomes base-owned and can authoritatively judge a
rebased `#1301`.

## Metadata and structured-data truth

All decisions use the existing server-only `getDeploymentReadiness()` result. No request,
client-side metadata, or new environment contract is introduced.

| State | Root/landing metadata | Structured data |
|---|---|---|
| Live | Search, barcode, and scoring-evidence availability stated without instant/science/health claims | Distinct `WebSite` and `WebApplication` IDs; SearchAction and feature list available |
| Demo/paused | Website and methodology remain available; live product data explicitly unavailable | `WebSite` only; no SearchAction or WebApplication capability claim |

The root title template remains available for child routes. The branded landing title is
absolute, producing exactly `TryVit — Know What You Eat` rather than a repeated brand
suffix. Page-specific route metadata continues to override root defaults normally.

Favicon, manifest, Apple PWA configuration, PWA icons, Open Graph image, Twitter image,
robots, and theme viewport assets remain in place. Only their crawler-facing descriptive
copy becomes readiness-aware.

## Nonvisual and rollback boundary

The production visual-DOM change is one data attribute. Metadata and JSON-LD are
crawler-facing and nonvisual.
There is no CSS, body copy, asset, dependency, API, database, Supabase, scanner,
authenticated-app, service-worker, or hosted-config change. Accepted Phase 5A.0d PNGs,
manifest, renderer policy, masks, and tolerances are untouched.

Rollback is one prerequisite revert. PR `#1301` remains independently draft and is not
modified or made ready by this work.

## Verification contract

- focused live/demo metadata, JSON-LD, landing, PWA, and Route-JS unit contracts;
- browser tests for current identity, changed headings/translations, near-match routes,
  missing/wrong/duplicate/wrong-boundary markers, and exact title;
- complete public smoke and complete unit suite;
- typecheck, lint, catalog-flags-off production build, design-system ratchet;
- local new-harness Route-JS public capture;
- PR Gate, CodeQL, hygiene, Golden Reference admission, Lighthouse, Quality Gate,
  immutable visuals, and base-owned Route-JS comparison.

Code-scanning and secret-scanning must remain zero. Inherited dev-scope Dependabot
alerts `#92`–`#94` must remain unchanged; this no-dependency prerequisite does not claim
zero repository vulnerabilities.
