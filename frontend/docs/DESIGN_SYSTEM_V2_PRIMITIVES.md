# Design System V2 canonical primitives

> **Phase:** 5A.1b · **Status:** API implemented; draft-PR and exact-head evidence pending · **Last updated:** 2026-08-11

This document freezes semantic APIs, interaction behavior, accessibility rules,
Server/Client boundaries, portal behavior, and V1 compatibility behavior. It does not
approve Living Label, the current mark, typography, imagery, or the current component
recipes as final art direction. Phase 5A.2 may restyle these APIs through semantic
tokens, recipe CSS, icon mappings, and composition.

Production remains scoped to `data-design-system="v1"`. The canonical V2 modules are
used only by the guarded `/dev/components` catalog until a later route-family phase is
explicitly authorized.

## Import and ownership rules

- Import from the owning module, not from a root design-system barrel.
- Static primitives and patterns are Server Component compatible.
- Interactive composites own the smallest explicit client entry.
- Do not add a root provider. Tooltip's existing Radix provider is local to each
  Tooltip instance.
- Do not import Lucide directly outside `src/design-system/icons/registry.tsx` in the
  governed V2/catalog boundary.
- Do not add raw SVG or emoji interface glyphs.

| API                                                          | Owning module                                            | Boundary                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `Icon`                                                       | `src/design-system/icons/Icon.tsx`                       | server-compatible                                                 |
| `Button`                                                     | `src/design-system/primitives/Button/Button.tsx`         | server-compatible                                                 |
| `IconButton`                                                 | `src/design-system/primitives/IconButton/IconButton.tsx` | server-compatible                                                 |
| `Surface`                                                    | `src/design-system/primitives/Surface/Surface.tsx`       | server-compatible                                                 |
| `CardLink`                                                   | `src/design-system/primitives/CardLink/CardLink.tsx`     | server-compatible                                                 |
| `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch` | `src/design-system/primitives/Field`                     | server-compatible; indeterminate Checkbox is a tiny client island |
| `Combobox`                                                   | `src/design-system/primitives/Combobox`                  | client entry                                                      |
| `Dialog`, `Sheet`                                            | `src/design-system/primitives/Overlay`                   | client entry                                                      |
| `Menu`                                                       | `src/design-system/primitives/Menu`                      | client entry                                                      |
| `Tabs`                                                       | `src/design-system/primitives/Tabs`                      | client entry                                                      |
| `Tooltip`                                                    | `src/design-system/primitives/Tooltip`                   | client entry                                                      |
| `PageState`                                                  | `src/design-system/patterns/PageState/PageState.tsx`     | server-compatible                                                 |

## Static actions and containers

### Button and IconButton

- Both render native `<button>` elements and default to `type="button"`; submit is
  always explicit.
- Semantic variants are `primary`, `secondary`, `quiet`, and `destructive`. Sizes are
  `sm`, `md`, and `lg`; every size keeps an actual 44 px minimum target.
- Button requires non-empty localized visible text and accepts optional registry
  `startIcon`/`endIcon` names. IconButton requires a non-empty localized `label` and
  one registry icon.
- Loading requires a non-empty localized `loadingLabel`, disables activation, exposes
  `aria-busy`, and replaces the accessible name. Unsafe `aria-label` or
  `aria-labelledby` overrides cannot replace the canonical pending/action name.
- Native button activation owns Enter and Space. No duplicate key handler exists.

### Surface

`Surface` accepts only `div`, `section`, `article`, or `aside`. Its semantic recipe axes
are `layer`, `density`, and `boundary`; they describe hierarchy rather than a palette,
radius, or shadow. The typed and runtime contracts reject interactive roles, focus,
content editing, dragging, access keys, autofocus, and DOM event handlers on the host.

### CardLink

Use `CardLink.Root`, `CardLink.Primary`, and `CardLink.Actions`. Root requires exactly
one direct Primary and accepts at most one direct Actions sibling. Primary is one native
Next anchor; actions sit above the stretched-link layer. Concrete interactive
descendants are rejected from Root and Primary. Root accepts only noninteractive
`article`, `div`, `li`, or `section` hosts and cannot be made focusable/event-driven.
Because React cannot inspect arbitrary custom output, opaque components are rejected at
the protected boundaries; use inert host markup, the compound slots, and the canonical
inert Icon where allowed.

## Field family

- Every control has one stable ID and a non-empty localized-text `<label>`; native
  void controls cannot receive children.
- Consumer `aria-describedby`, hint, counter, and error IDs are merged in that order;
  an error never removes the hint. Errors use `aria-errormessage` and are announced only
  when `announceError` is explicitly requested.
- Native `required`, `disabled`, `readOnly`, `autoComplete`, `inputMode`, and validity
  semantics are preserved.
- Textarea counts use non-empty inert copy and are caller-controlled, visible
  descriptions—not per-keystroke live regions. Select remains native.
- Checkbox remains one stable native input across mixed/checked transitions; only the
  indeterminate IDL property requires a client synchronizer. Switch is a native
  checkbox with `role="switch"`; its visible state copy
  is supplementary and excluded from the accessible name. Native Space activation runs
  exactly once.

## Composite interactions

### Combobox

Combobox is an editable, single-select listbox. Focus stays on the input and
`aria-activedescendant` identifies a simple, noninteractive option. Arrow keys open and
wrap; Enter selects only an active enabled option; Escape closes without clearing;
Tab closes without interception except when the input owns a containing modal's first or
last Tab boundary, where focus wraps within that modal. Text-editing Home/End and platform
shortcuts remain native. Async loading, empty, and error states are visible and announced politely.
Option values must be non-empty and unique; a removed async option cannot leave a stale
active ID or submitted value and requests one explicit clear transition. Labels and
optional descriptions are localized strings; arbitrary React
content and interactive descendants are rejected before they can enter an option. A
committed `value`/`defaultValue` is a string and the explicit clear state is `null`;
resuming text entry after a selection emits `(null, null)`. A named hidden field maps
that null state to the HTML empty string only at the form-serialization boundary.

### Dialog and Sheet

Both use conditionally mounted native `<dialog>` plus `showModal()`. They require a
visible title and localized close label, expose a modal role, rely on native inertness,
and add a topmost-only rendered sequential Tab boundary guard. Direction-aware radio
groups, SVG/native stops, programmatically focused static content, and nested
browsing-context exits retain a contained next destination; boundary moves scroll the
focused control into view. Positive `tabIndex` descendants, HTML custom-element hosts,
customized built-ins, and inspectable open shadow-root focus scopes are rejected composition
boundaries. Closed shadow roots cannot be introspected and are outside the supported contract;
use native zero-order light DOM.
Native movement remains unchanged between interior stops. An explicit initial-focus
policy requires any initial-focus ref to resolve inside the modal. Escape, close-button,
backdrop, and programmatic dismissal
restore the connected invoker. `restoreFocusRef` supplies a different connected logical
target when a workflow requires it. Backdrop dismissal requires primary pointer down
and up on the backdrop, so a drag crossing the boundary cannot close.
Restoration settles in the next task after native or synthesized dismissal work and
never steals focus that has already moved beyond the document body or original invoker.
Scroll locking is reference-counted. Sheet placement is recipe-controlled rather than
a public art-direction prop.

### Menu

Menu is for commands, not ordinary navigation. Its trigger has visible localized text
and an optional inert registry icon. Every entry label is inert localized text, and a
menu without at least one actionable entry fails closed. DOM focus enters `menuitem` or
`menuitemcheckbox` entries. Arrow keys wrap; Home/End, printable typeahead, Enter/Space,
disabled focusability, Escape restoration, outside pointer, and forward/backward Tab
destinations are defined. Leaving the composite by pointer, Tab, or programmatic focus
closes it without stealing the destination's focus. Nested modal Tab destinations remain
inside the nearest open dialog. At a document edge, where browser chrome is not a
script-addressable destination from a portal, Menu cancels that Tab, closes, and reanchors
on its trigger so the next native Tab leaves in the requested direction. Only the top
overlay responds to Escape/outside
dismissal. Checkbox rows always reserve a visible border-and-check indicator so state
survives forced colors without relying on color alone.

### Tabs

Tabs requires at least one enabled item and maintains one roving tab stop with reciprocal
tab/tabpanel IDs. Labels are inert localized strings and wrap in the bounded vertical
layout. Horizontal arrows
reverse in RTL; vertical arrows use Up/Down; Home/End wrap past disabled tabs. Automatic
activation is for already-rendered panels; manual activation uses Enter/Space. Cross-axis
scroll keys are not intercepted. URL persistence belongs to a controlled route owner,
not the primitive.

### Tooltip

Tooltip uses the already-installed Radix primitive behind a semantic logical-placement
API. Focus stays on the real trigger. Hover/focus opens, Escape dismisses, hover remains
persistent across trigger and content. Content is non-empty localized text—not a React
subtree—so interactive descendants cannot enter the nonessential tooltip. Coarse-pointer
activation is not intercepted. No global provider or arbitrary delay API is exposed.

## Portal scope and overlay ordering

Every popup carries `data-design-system="v2"` plus effective theme, `dir`, and `lang`.
The portal target is the nearest open dialog's `[data-ds-overlay-host]`, then the nearest
explicit ancestor host, otherwise `document.body`. This keeps nested Menu, Combobox, and
Tooltip content inside the native modal/inert layer, lets guarded catalogs keep popup
content inside their existing landmark, and leaves the production fallback unchanged
while the root remains V1. A shared stack ensures only the top composite processes
dismissal.
Anchored popups clamp to the effective visual viewport, including its offset and reduced
height when a mobile virtual keyboard is visible.

## PageState

PageState provides `loading`, `empty`, `degraded`, `error`, `offline`, `paused`, and
`recovering`. It requires non-empty localized title copy and owns a caller-selected
h1–h6 hierarchy, supplementary registry icon,
optional recovery actions/content, polite defaults, and an explicit assertive opt-in.
Loading/recovering place `aria-busy` on a separate update region so it cannot suppress
the visible atomic status announcement. Empty is not a live region.

## Icons and future domain glyphs

`Icon` exposes only `name`, semantic size, optional informational label, and class name;
it cannot receive focus or event handlers. Registry names describe meaning, so Phase
5A.2 may change a drawing without changing primitive APIs.

The custom `domain.*` registry is intentionally empty. Admission requires a controlled
TSX/SVG repository path, source, license, SHA-256, 24 px-grid review, forced-color
review, and candidate/5A.2 approval state. Phase 5A.1b adds no identity artwork.
Before the first production client migration, Route JS evidence must measure the static
interface registry and split it if retaining all mapped glyphs would exceed that route's
budget. The current registry is reachable only from the guarded catalog.

## Motion and resilience

Components use only the approved 0/120/180/240/360 ms recipes; the reserved 500 ms
landing narrative is not used. Animations are transform/opacity only, hover styling is
fine-pointer gated, and reduced motion renders the complete final state immediately.
There is no `transition-all`, layout/blur/filter animation, or content hidden pending
JavaScript. Forced colors keep real borders/outlines and non-color state semantics.
Overlay sizes honor dynamic viewport and safe-area bounds.

## V1 compatibility map

Only existing production consumers receive facades:

| Existing entry                        | Exact implementation owner                  | Contract                              |
| ------------------------------------- | ------------------------------------------- | ------------------------------------- |
| `components/common/Button.tsx`        | `design-system/compat-v1/Button.tsx`        | exact exports, DOM, classes, behavior |
| `components/common/Card.tsx`          | `design-system/compat-v1/Card.tsx`          | exact exports, DOM, classes, behavior |
| `components/common/ConfirmDialog.tsx` | `design-system/compat-v1/ConfirmDialog.tsx` | exact exports, DOM, classes, behavior |
| `components/common/EmptyState.tsx`    | `design-system/compat-v1/EmptyState.tsx`    | exact exports, DOM, classes, behavior |
| `components/common/InfoTooltip.tsx`   | `design-system/compat-v1/InfoTooltip.tsx`   | exact exports, DOM, classes, behavior |

The pre-existing `components/common/Icon.tsx` remains a separately audited V1 bridge;
it is not rewritten or claimed as a V2 facade. No speculative facade exists for an
unused primitive.

## Catalog evidence

The guarded catalog retains four stable scenes and adds nine deterministic interaction
captures per case, including populated, loading, empty, and load-error Combobox states.
Its exact 18-case matrix produces 72 base scenes, 162 open/selected states, 24 reviewable
text-spacing/200%-zoom resilience states, 36 contact sheets, an 18-record evidence
ledger, and a manifest: 296 files in total. Evidence covers EN/PL/DE, 390/768/1440,
light/dark/system, forced colors, reduced motion, fine/coarse pointer, default/open-state
Axe, keyboard/focus/portal behavior,
44 px targets, text spacing, overflow, and 200% reflow through 35 checks per case. These
files are review candidates, not production baselines or Phase 5A.2 Golden References.
The Dialog and Sheet journeys include a nested Menu and ready Combobox in the exact
modal portal host, plus default-heading and explicit-ref focus entry, one-Tab boundary
containment, popup-only Escape, and focus restoration without adding artifact paths.
The altered text-spacing and 200%-zoom states are retained as named PNGs after automated
clipping, sibling-overlap, visible-point-obscuration, and overflow screening so geometry
checks and human visual judgment remain distinct.

## Non-goals

5A.1b does not migrate production routes, finalize brand or art direction, add a runtime
dependency, add a root provider, alter tokens/themes/motion taxonomy, change route/API/
database/PWA behavior, or replace immutable Phase 5A.0d baselines.
