import { describe, expect, it } from "vitest";

import {
  advanceCatalogScrollQuiescence,
  CATALOG_SCROLL_QUIET_FRAMES_REQUIRED,
  CATALOG_SCROLL_QUIESCENCE_TIMEOUT_MS,
  initialCatalogScrollQuiescenceState,
} from "@/../e2e/helpers/catalog-scroll-quiescence";

function sampleRevisions(initialRevision: number, revisions: readonly number[]) {
  return revisions.reduce(
    (state, revision) => advanceCatalogScrollQuiescence(state, revision),
    initialCatalogScrollQuiescenceState(initialRevision),
  );
}

describe("Phase 5A.1 catalog scroll quiescence", () => {
  it("settles only after four consecutive unchanged animation-frame samples", () => {
    const beforeFinalFrame = sampleRevisions(0, [0, 0, 0]);
    expect(beforeFinalFrame).toEqual({
      observedRevision: 0,
      quietFramesObserved: 3,
      settled: false,
    });

    expect(sampleRevisions(0, [0, 0, 0, 0])).toEqual({
      observedRevision: 0,
      quietFramesObserved: CATALOG_SCROLL_QUIET_FRAMES_REQUIRED,
      settled: true,
    });
  });

  it("resets the quiet-frame count when a late scroll revision arrives", () => {
    const afterLateScroll = sampleRevisions(0, [0, 0, 1]);
    expect(afterLateScroll).toEqual({
      observedRevision: 1,
      quietFramesObserved: 0,
      settled: false,
    });

    expect(sampleRevisions(0, [0, 0, 1, 1, 1, 1, 1])).toEqual({
      observedRevision: 1,
      quietFramesObserved: CATALOG_SCROLL_QUIET_FRAMES_REQUIRED,
      settled: true,
    });
  });

  it("keeps the browser wait bounded and rejects invalid sampler input", () => {
    expect(CATALOG_SCROLL_QUIESCENCE_TIMEOUT_MS).toBe(1_000);
    expect(() => advanceCatalogScrollQuiescence(
      initialCatalogScrollQuiescenceState(0),
      -1,
    )).toThrow(/non-negative integer/u);
    expect(() => advanceCatalogScrollQuiescence(
      initialCatalogScrollQuiescenceState(0),
      0,
      0,
    )).toThrow(/positive integer/u);
  });
});
