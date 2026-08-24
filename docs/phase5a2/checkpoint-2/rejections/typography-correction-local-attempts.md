# Retained typography-correction attempts

These local attempts are rejected diagnostic evidence. They are not averaged into the
replacement and do not replace the exact-source packet or exact-head CI artifacts.

## Rejected exact-head artifact

- source: `e3b18dbd944a0cfeb7fec16763f6d6a4ff80a591`;
- tree: `3c01744a1d123ceb1fa1143539d7740b9cbcff8d`;
- run/artifact: `32678279231` / `9503479414`;
- staged manifest SHA-256:
  `177a0731fc2440adbf9af9678d4195804438d9f0aa85d645d4e351fe096b044c`;
- typography board: 136,533 bytes, SHA-256
  `6b61fd0e1289b7b5d666ae66924a04a5cb0b794afd94da443469d923317863ac`.

Original-resolution inspection confirmed Polish/German overlap, a German boundary
crossing and clipped final line, premature tabular-row start, and labels that did not
match the shared computed specimen size.

## Contract-first failure

The new light/dark geometry contract was run before source correction. Both themes
failed with zero governed specimen records, proving the old board did not expose or
satisfy the truthful scale/containment contract.

## Bounded font-assay corrections

1. The first 74,480-byte subset omitted `tnum`; the browser measured a `6px` digit-width
   range. The attempt was rejected and `tnum` was added without lowering the check.
2. The next attempt passed transfer and coverage but measured fallback CLS
   `0.012789079830970293`, above the assay limit `0.01`. Exact proof-width fallback
   metrics replaced the x-height-only approximation.
3. The next attempt passed CLS but exposed `14.9375px` top movement; top-aligned
   specimen geometry removed it.
4. The next attempt exposed `29.890625px` height movement from different automatic line
   wrapping. Deliberate, complete two-line compositions removed it without shortening
   the English, Polish, German, or numeric proof.

The accepted pre-commit attempt measures 75,004 transferred bytes, zero missing proof
coverage, `0px` digit-width range, `0` fallback CLS, and `0px` top/height delta.

## Invalidated first replacement packet

The first exact-source replacement packet was captured from `eaffa77e67d0bee5566966b9d17e021117e60058`
with manifest `e24b555304fb7319d426b892ea6c9bacb32e46d44bfea0bbf88f24a1ff44bc62`.
Before any current reviewer score was accepted, a fail-closed audit found that the new
comparison-header metadata computed to `10.56px`, below the existing `12px` meaningful-
metadata floor. All three in-flight review lanes were interrupted, the packet remains
recoverable in Git, and no score from it qualifies. The causal correction sets that
metadata to `12px`; the complete packet and three fresh lanes must be regenerated.

## Rejected fresh-review packet

The next packet was bound to source/tree
`4d29d5007511a438e14e002b3a0df122007b8de5` /
`d1875fccb9b9b0d4f45ff8191bf8cbcee21ce38f`, manifest
`85309352e63b40d5e735d260c68d35668f0582ec0d0e10f8b10f85ece1ca7cf8`, and
85 files / 7,197,539 bytes. Lane C independently passed every byte/provenance check but
failed visual-artifact QA on:

- `stills/localized/landing--1440x900--dark--de.png`: both primary actions crossed and
  were clipped by the 900px capture boundary;
- `stills/localized/product--1440x900--dark--de.png`: untranslated `review fixture`
  suffix;
- `stills/localized/product--390x844--light--pl.png`: untranslated `review fixture`
  suffix.

Before scoring completed, Reviewer B also found a truthfulness veto: ten of the 12 raw
`motion-terminal/*` manifest records carried start-state/reference/theme metadata
instead of the observed terminal metadata. The remaining score lane was interrupted;
no score from this packet qualifies.

The causal correction localizes the product suffix, keeps the German desktop actions
inside the governed viewport, derives terminal-still metadata from the observed journey
record, and makes the staged verifier compare every terminal record with its actual
journey. A new exact source, complete packet, and three entirely new lanes are required.
