# Initial-review correction cycle

The primary implementation accepted the in-scope findings without altering the external
vetoes.

Production corrections at `1f7ad2c0e52833f06a3d17e010ad653b366ee291`:

- theme and narrative controls are disabled in server/no-JavaScript output and enabled
  deterministically after hydration via `useSyncExternalStore`;
- the paused/demo footer links to service status instead of unconditionally offering
  sign-in;
- forced-color identity uses `CanvasText`, with link treatment retained only for actual
  navigation;
- disabled controls receive an explicit non-interactive visual state.

Evidence corrections:

- the 368×800 encoded content area for recordings initiated from a 390×844 page viewport
  is disclosed;
- text-spacing automation is limited to horizontal containment, with visual review
  explicitly separated from geometry proof;
- the manifest claim is limited to media and motion observation;
- Fetch and Manifest transfers are included and independent component-median arithmetic
  is explained;
- all stills and recordings were regenerated and re-hashed against the corrected source;
- five new mobile and five new desktop Lighthouse samples were retained.

The correction does not change the inherited root JSON-LD, base-owned route-JS harness,
immutable baseline policy, legal/native-language boundary, or performance threshold.
