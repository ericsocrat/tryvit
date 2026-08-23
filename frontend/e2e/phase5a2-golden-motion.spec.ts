import { writeFileSync } from "node:fs";

import { expect, test, type Page } from "./fixtures/safe-test";
import {
  assertGoldenFileBound,
  goldenOutputPath,
  installGoldenRuntimeHooks,
  openGoldenCapture,
  prepareGoldenAnchoredTarget,
  startGoldenRecording,
} from "./helpers/phase5a2-golden-reference";
import {
  GOLDEN_JOURNEYS,
  GOLDEN_MOTION_RECORDINGS,
  GOLDEN_VIDEO_STATE_DWELL_MS,
  motionTerminalStillRelativePath,
} from "@/../tooling/design-system/golden-reference/capture-contract";

async function dwell(page: Page): Promise<void> {
  await page.evaluate(
    (duration) => new Promise<void>((resolve) => window.setTimeout(resolve, duration)),
    GOLDEN_VIDEO_STATE_DWELL_MS,
  );
}

async function performJourney(page: Page, reference: (typeof GOLDEN_MOTION_RECORDINGS)[number]["reference"]) {
  switch (reference) {
    case "landing": {
      await page.getByRole("button", { name: "Unfold the evidence" }).click();
      await expect(page.getByRole("button", { name: "Fold back to source" })).toHaveAttribute("aria-pressed", "true");
      await dwell(page);
      await page.getByRole("button", { name: "Fold back to source" }).click();
      await expect(page.getByRole("button", { name: "Unfold the evidence" })).toHaveAttribute("aria-pressed", "false");
      await dwell(page);
      await page.getByRole("button", { name: "Unfold the evidence" }).click();
      await expect(page.getByRole("button", { name: "Fold back to source" })).toHaveAttribute("aria-pressed", "true");
      await dwell(page);
      await page.getByRole("button", { name: "Preview dark system" }).click();
      await expect(page.locator("[data-golden-reference]")).toHaveAttribute("data-theme", "dark");
      await dwell(page);
      break;
    }
    case "authentication": {
      const email = page.getByLabel("Email address");
      const password = page.getByLabel("Password");
      await email.fill("");
      await password.fill("");
      await page.getByRole("button", { name: "Continue" }).click();
      await dwell(page);
      await email.fill("wrong@example.test");
      await password.fill("evidence");
      await page.getByRole("button", { name: "Continue" }).click();
      await dwell(page);
      await email.fill("review@tryvit.local");
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.locator("[data-golden-live-state='success']")).toBeVisible();
      await dwell(page);
      await page.getByRole("button", { name: "Open authenticated home" }).click();
      await expect(page).toHaveURL(/\/golden\/home\?.*state=returning/u);
      await expect(page.locator("[data-golden-reference='home']")).toHaveAttribute("data-golden-state", "returning");
      await page.locator("#golden-main").focus();
      await dwell(page);
      break;
    }
    case "home": {
      const menu = page.getByRole("button", { name: "More decision actions" });
      await prepareGoldenAnchoredTarget(page, menu);
      await menu.press("ArrowDown");
      await expect(page.getByRole("menuitem").first()).toBeFocused();
      await dwell(page);
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await dwell(page);
      await page.getByRole("button", { name: "Resume evidence review" }).click();
      await dwell(page);
      await page.getByRole("link", { name: "Resume evidence review" }).click();
      await expect(page).toHaveURL(/\/golden\/product\?.*state=partial/u);
      await expect(page.locator("[data-golden-reference='product']")).toHaveAttribute("data-golden-state", "partial");
      await page.locator("#golden-main").focus();
      await dwell(page);
      break;
    }
    case "search": {
      await page.getByLabel("Search synthetic products").fill("oat");
      await dwell(page);
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.locator("[data-golden-live-state='results']")).toBeVisible();
      await dwell(page);
      await page.getByRole("button", { name: "Filters" }).click();
      const dialog = page.getByRole("dialog", { name: "Filters" });
      await dialog.getByLabel("Include partial records").check();
      await dialog.getByLabel("Include records without a score").uncheck();
      await dialog.getByRole("button", { name: "Apply filters" }).click();
      await dwell(page);
      break;
    }
    case "product": {
      const ingredients = page.getByRole("tab", { name: "Ingredients" });
      await ingredients.focus();
      await ingredients.press("Enter");
      await dwell(page);
      const provenance = page.getByRole("button", { name: "Open provenance" });
      await provenance.click();
      await expect(page.getByRole("dialog", { name: "Source and method provenance" })).toBeVisible();
      await dwell(page);
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
      const menu = page.getByRole("button", { name: "Comparison actions" });
      await prepareGoldenAnchoredTarget(page, menu);
      await menu.press("ArrowDown");
      await dwell(page);
      await page.keyboard.press("Escape");
      break;
    }
    case "scanner": {
      await page.getByRole("button", { name: "Review permission request" }).click();
      await dwell(page);
      await page.getByRole("button", { name: "Allow simulation" }).click();
      await page.getByRole("button", { name: "Continue acquisition" }).click();
      await dwell(page);
      await page.getByRole("button", { name: "Recognize synthetic barcode" }).click();
      await dwell(page);
      await page.getByRole("button", { name: "Build evidence result" }).click();
      await expect(page.locator("[data-golden-live-state='matched']")).toBeVisible();
      await dwell(page);
      break;
    }
  }
}

test("records normal and reduced-motion Golden journeys with terminal frames", async ({ page }) => {
  test.setTimeout(600_000);
  const runtimeErrors = installGoldenRuntimeHooks(page);
  const actual: Array<Record<string, unknown>> = [];

  for (const capture of GOLDEN_MOTION_RECORDINGS) {
    await openGoldenCapture(page, capture);
    await dwell(page);
    const recording = await startGoldenRecording(page, capture);
    await performJourney(page, capture.reference);
    const terminalPath = goldenOutputPath(motionTerminalStillRelativePath(capture));
    await page.screenshot({ animations: "disabled", caret: "hide", fullPage: false, path: terminalPath, scale: "css" });
    assertGoldenFileBound(terminalPath, "png");
    await dwell(page);
    await recording.stop();

    actual.push(await page.evaluate(({ reference, mode }) => {
      const root = document.querySelector<HTMLElement>("[data-golden-reference]");
      const live = document.querySelector<HTMLElement>("[data-golden-live-state]");
      const active = document.activeElement as HTMLElement | null;
      const focus = (() => {
        if (!active || active === document.body) return null;
        if (active.id) return `#${active.id}`;
        if (active.hasAttribute("data-golden-live-state")) {
          return `[data-golden-live-state='${active.getAttribute("data-golden-live-state")}']`;
        }
        if (active.getAttribute("aria-haspopup")) {
          return `${active.tagName.toLowerCase()}[aria-haspopup='${active.getAttribute("aria-haspopup")}']`;
        }
        const role = active.getAttribute("role");
        return role ? `[role='${role}']` : active.tagName.toLowerCase();
      })();
      return {
        recordingReference: reference,
        reference: root?.dataset.goldenReference ?? null,
        mode,
        route: location.pathname + location.search,
        fixtureState: root?.dataset.goldenState ?? null,
        theme: root?.dataset.theme ?? null,
        liveState: live?.dataset.goldenLiveState ?? root?.dataset.goldenState ?? null,
        focus,
        announcement: [...document.querySelectorAll<HTMLElement>("[aria-live]")]
          .map((element) => element.innerText.replace(/\s+/gu, " ").trim())
          .filter(Boolean)
          .at(-1) ?? null,
      };
    }, { reference: capture.reference, mode: capture.mode }));
  }

  expect(runtimeErrors).toEqual([]);
  writeFileSync(
    goldenOutputPath("journeys.json"),
    `${JSON.stringify({ schemaVersion: 1, contracts: GOLDEN_JOURNEYS, actual }, null, 2)}\n`,
    "utf8",
  );
});
