export const CATALOG_SCROLL_QUIET_FRAMES_REQUIRED = 4;
export const CATALOG_SCROLL_QUIESCENCE_TIMEOUT_MS = 1_000;

export interface CatalogScrollQuiescenceState {
  readonly observedRevision: number;
  readonly quietFramesObserved: number;
  readonly settled: boolean;
}

export function initialCatalogScrollQuiescenceState(
  revision: number,
): CatalogScrollQuiescenceState {
  return {
    observedRevision: revision,
    quietFramesObserved: 0,
    settled: false,
  };
}

export function advanceCatalogScrollQuiescence(
  state: CatalogScrollQuiescenceState,
  revision: number,
  quietFramesRequired = CATALOG_SCROLL_QUIET_FRAMES_REQUIRED,
): CatalogScrollQuiescenceState {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new TypeError("Catalog scroll revision must be a non-negative integer.");
  }
  if (!Number.isInteger(quietFramesRequired) || quietFramesRequired < 1) {
    throw new TypeError("Catalog quiet-frame requirement must be a positive integer.");
  }
  if (revision !== state.observedRevision) {
    return {
      observedRevision: revision,
      quietFramesObserved: 0,
      settled: false,
    };
  }
  const quietFramesObserved = Math.min(
    quietFramesRequired,
    state.quietFramesObserved + 1,
  );
  return {
    observedRevision: revision,
    quietFramesObserved,
    settled: quietFramesObserved >= quietFramesRequired,
  };
}
