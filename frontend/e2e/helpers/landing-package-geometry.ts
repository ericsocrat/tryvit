// The helper lives below e2e/ and shares the guarded fixture's Page/expect types.
// eslint-disable-next-line no-restricted-imports
import { expect, type Page } from "../fixtures/safe-test";

const GEOMETRY_EPSILON = 1;
const OWNED_REGION_GAP_PX = 4;

export async function expectLandingPackageTextRegions(page: Page): Promise<void> {
  const geometry = await page
    .locator("[data-landing-package-specimen]")
    .evaluate((specimen, epsilon) => {
      const title = specimen.querySelector<HTMLElement>("[data-landing-package-title]");
      const marker = specimen.querySelector<HTMLElement>("[data-landing-synthetic-marker]");
      if (!title || !marker) throw new Error("Package text-region markers are missing");

      const specimenRect = specimen.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();
      return {
        gap: markerRect.top - titleRect.bottom,
        markerFontSize: Number.parseFloat(getComputedStyle(marker).fontSize),
        markerFits:
          marker.scrollWidth <= marker.clientWidth + epsilon &&
          marker.scrollHeight <= marker.clientHeight + epsilon,
        marker: markerRect.toJSON(),
        specimen: specimenRect.toJSON(),
        titleFits:
          title.scrollWidth <= title.clientWidth + epsilon &&
          title.scrollHeight <= title.clientHeight + epsilon,
        title: titleRect.toJSON(),
      };
    }, GEOMETRY_EPSILON);

  expect(geometry.markerFontSize).toBeGreaterThanOrEqual(12);
  expect(geometry.gap).toBeGreaterThanOrEqual(OWNED_REGION_GAP_PX - GEOMETRY_EPSILON);
  expect(geometry.titleFits).toBe(true);
  expect(geometry.markerFits).toBe(true);
  for (const region of [geometry.title, geometry.marker]) {
    expect(region.width).toBeGreaterThan(0);
    expect(region.height).toBeGreaterThan(0);
    expect(region.left).toBeGreaterThanOrEqual(geometry.specimen.left - GEOMETRY_EPSILON);
    expect(region.top).toBeGreaterThanOrEqual(geometry.specimen.top - GEOMETRY_EPSILON);
    expect(region.right).toBeLessThanOrEqual(geometry.specimen.right + GEOMETRY_EPSILON);
    expect(region.bottom).toBeLessThanOrEqual(geometry.specimen.bottom + GEOMETRY_EPSILON);
  }
}
