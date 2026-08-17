import { expect, test, type Page } from "./fixtures/safe-test";
import {
  CATALOG_SCROLL_QUIESCENCE_TIMEOUT_MS,
  CATALOG_SCROLL_QUIET_FRAMES_REQUIRED,
} from "./helpers/catalog-scroll-quiescence";

const CATALOG_PATH = "/dev/components";
type PrimitiveLocator = ReturnType<Page["locator"]>;
const runtimeErrors = new WeakMap<Page, string[]>();

interface CrossBrowserScrollProbe {
  revision: number;
  cleanup: () => void;
}

async function openCatalog(page: Page): Promise<void> {
  await page.emulateMedia({
    colorScheme: "light",
    forcedColors: "none",
    reducedMotion: "reduce",
  });
  const response = await page.goto(CATALOG_PATH);
  expect(response?.ok()).toBe(true);
  await expect(page.locator("[data-design-system='v2']").first()).toBeAttached();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function armCrossBrowserScrollProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browserGlobal = globalThis as typeof globalThis & {
      __phase5a2CrossBrowserScrollProbe?: CrossBrowserScrollProbe;
    };
    browserGlobal.__phase5a2CrossBrowserScrollProbe?.cleanup();
    const probe: CrossBrowserScrollProbe = {
      revision: 0,
      cleanup: () => undefined,
    };
    const observeScroll = () => {
      probe.revision += 1;
    };
    probe.cleanup = () => document.removeEventListener("scroll", observeScroll, true);
    document.addEventListener("scroll", observeScroll, true);
    browserGlobal.__phase5a2CrossBrowserScrollProbe = probe;
  });
}

async function waitForCrossBrowserScrollQuiescence(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ quietFramesRequired, timeoutMs }) => new Promise<boolean>((resolve) => {
      const browserGlobal = globalThis as typeof globalThis & {
        __phase5a2CrossBrowserScrollProbe?: CrossBrowserScrollProbe;
      };
      const probe = browserGlobal.__phase5a2CrossBrowserScrollProbe;
      if (!probe) {
        resolve(false);
        return;
      }
      let observedRevision = probe.revision;
      let quietFramesObserved = 0;
      let frame = 0;
      const timer = setTimeout(() => {
        cancelAnimationFrame(frame);
        resolve(false);
      }, timeoutMs);
      const sample = () => {
        if (probe.revision === observedRevision) quietFramesObserved += 1;
        else {
          observedRevision = probe.revision;
          quietFramesObserved = 0;
        }
        if (quietFramesObserved >= quietFramesRequired) {
          clearTimeout(timer);
          resolve(true);
          return;
        }
        frame = requestAnimationFrame(sample);
      };
      frame = requestAnimationFrame(sample);
    }),
    {
      quietFramesRequired: CATALOG_SCROLL_QUIET_FRAMES_REQUIRED,
      timeoutMs: CATALOG_SCROLL_QUIESCENCE_TIMEOUT_MS,
    },
  );
}

async function cleanupCrossBrowserScrollProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const browserGlobal = globalThis as typeof globalThis & {
      __phase5a2CrossBrowserScrollProbe?: CrossBrowserScrollProbe;
    };
    browserGlobal.__phase5a2CrossBrowserScrollProbe?.cleanup();
    delete browserGlobal.__phase5a2CrossBrowserScrollProbe;
  });
}

async function prepareAnchoredTarget(
  page: Page,
  target: PrimitiveLocator,
): Promise<void> {
  await armCrossBrowserScrollProbe(page);
  try {
    await target.scrollIntoViewIfNeeded();
    expect(await waitForCrossBrowserScrollQuiescence(page)).toBe(true);
    expect(await target.evaluate((element) => {
      if (!(element instanceof HTMLElement)) return false;
      element.focus({ preventScroll: true });
      return element.ownerDocument.activeElement === element;
    })).toBe(true);
    await expect(target).toBeFocused();
    expect(await waitForCrossBrowserScrollQuiescence(page)).toBe(true);
  } finally {
    await cleanupCrossBrowserScrollProbe(page);
  }
}

function durationsResolveImmediately(value: string): boolean {
  return value.split(",").every((duration) => {
    const normalized = duration.trim();
    if (normalized === "0s" || normalized === "0ms" || normalized === "0") return true;
    const match = /^(\d*\.?\d+)(ms|s)$/u.exec(normalized);
    return match !== null && Number(match[1]) === 0;
  });
}

async function expectReducedMotion(locator: PrimitiveLocator): Promise<void> {
  const durations = await locator.evaluate((element) => [
    ...[element, ...element.querySelectorAll("*")].map((candidate) => {
      const style = getComputedStyle(candidate);
      return [style.animationDuration, style.transitionDuration];
    }),
    ...(element instanceof HTMLDialogElement
      ? [[
          getComputedStyle(element, "::backdrop").animationDuration,
          getComputedStyle(element, "::backdrop").transitionDuration,
        ]]
      : []),
  ]);
  expect(durations.every((pair) => pair.every(durationsResolveImmediately))).toBe(true);
}

async function expectForcedColorEquivalent(
  page: Page,
  surface: PrimitiveLocator,
): Promise<void> {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  const forcedColorsActive = await page.evaluate(() =>
    matchMedia("(forced-colors: active)").matches
  );
  expect(forcedColorsActive).toBe(true);
  await expect.poll(() => surface.evaluate((element) => getComputedStyle(element).boxShadow))
    .toBe("none");
  // ARIA and DOM state remain the authority; a Linux-emulated system palette
  // is not branded Firefox/Safari or native OS High Contrast certification.
  await expect(surface).toBeVisible();
}

async function expectPortalOwnedByModal(
  overlay: PrimitiveLocator,
  modal: PrimitiveLocator,
): Promise<void> {
  expect(await overlay.evaluate((element) => {
    const portalRoot = element.closest<HTMLElement>("[data-ds-portal-root]");
    return portalRoot?.parentElement?.hasAttribute("data-ds-overlay-host") ?? false;
  })).toBe(true);
  expect(await overlay.evaluate((element) =>
    element.closest("dialog[open]")?.getAttribute("data-ds-component")
  )).toBe(await modal.getAttribute("data-ds-component"));
}

async function expectFocusRestored(page: Page, trigger: PrimitiveLocator): Promise<void> {
  try {
    await expect(trigger).toBeFocused({ timeout: 1_000 });
  } catch {
    const safeState = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        tag: active?.tagName.toLowerCase() ?? null,
        role: active?.getAttribute("role") ?? null,
        tabIndex: active?.tabIndex ?? null,
        dsComponent: active?.dataset.dsComponent ?? null,
        dsPart: active?.dataset.dsPart ?? null,
        catalogProbe: active?.dataset.catalogProbe ?? null,
        inOpenDialog: Boolean(active?.closest("dialog[open]")),
      };
    });
    throw new Error(`focus-restoration-invalid:${JSON.stringify(safeState)}`);
  }
}

async function exerciseModal(page: Page, component: "dialog" | "sheet"): Promise<void> {
  const trigger = page.locator(`[data-catalog-probe="${component}-trigger"]`);
  await prepareAnchoredTarget(page, trigger);
  await page.keyboard.press("Enter");

  const modal = page.locator(`dialog[data-ds-component="${component}"][open]`);
  const close = modal.locator('[data-ds-part="close"]');
  const initialAction = modal.locator('[data-catalog-focus="initial"]');
  const initialFocus = component === "sheet" ? modal.getByRole("heading") : initialAction;
  const lastFocus = modal.locator(
    `[data-catalog-probe="${component}-nested-combobox"] [data-ds-part="input"]`,
  );
  await expect(modal).toHaveAttribute("aria-modal", "true");
  expect(await modal.evaluate((element) =>
    ["aria-labelledby", "aria-describedby"].every((attribute) => {
      const id = element.getAttribute(attribute);
      return Boolean(id && document.getElementById(id));
    })
  )).toBe(true);
  await expect(initialFocus).toBeFocused();
  await expectReducedMotion(modal);

  await lastFocus.focus();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(lastFocus).toBeFocused();
  await trigger.evaluate((element) => element.focus());
  expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  const nestedMenuTrigger = modal.locator(
    `[data-catalog-probe="${component}-nested-menu"] [data-ds-part="trigger"]`,
  );
  await nestedMenuTrigger.focus();
  await page.keyboard.press("ArrowDown");
  const nestedMenu = modal.locator(
    '[data-ds-overlay-host] [data-ds-component="menu"][data-ds-part="content"]',
  );
  await expect(nestedMenu).toBeVisible();
  await expectPortalOwnedByModal(nestedMenu, modal);
  await page.keyboard.press("Escape");
  await expect(nestedMenu).toBeHidden();
  await expect(modal).toBeVisible();
  await expect(nestedMenuTrigger).toBeFocused();
  await nestedMenuTrigger.click();
  await expect(nestedMenu).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(nestedMenu).toBeHidden();
  await expect(modal).toBeVisible();

  const nestedCombobox = modal.locator(
    `[data-catalog-probe="${component}-nested-combobox"] [data-ds-part="input"]`,
  );
  await nestedCombobox.focus();
  await page.keyboard.press("ArrowDown");
  const nestedPopup = modal.locator(
    '[data-ds-overlay-host] [data-ds-component="combobox"][data-ds-part="content"]',
  );
  await expect(nestedCombobox).toHaveAttribute("aria-expanded", "true");
  await expect(nestedPopup.getByRole("option")).toHaveCount(3);
  await expectPortalOwnedByModal(nestedPopup, modal);
  await page.keyboard.press("Escape");
  await expect(nestedPopup).toBeHidden();
  await expect(nestedCombobox).toBeFocused();
  await expect(modal).toBeVisible();
  await nestedCombobox.click();
  await expect(nestedPopup).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(nestedPopup).toBeHidden();
  await expect(modal).toBeVisible();

  await expectForcedColorEquivalent(page, modal);
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expectFocusRestored(page, trigger);

  // The catalog probe controls open state. Reopening proves that an Escape
  // transition did not desynchronise the controlled source of truth.
  await trigger.click();
  await expect(modal).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(modal).toBeHidden();
  await expectFocusRestored(page, trigger);
}

test.describe("Phase 5A.2 cross-browser primitive admission", () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    runtimeErrors.set(page, errors);
    page.on("pageerror", () => errors.push("pageerror"));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push("console-error");
    });
    await openCatalog(page);
  });

  test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page) ?? []).toEqual([]);
  });

  test("Dialog keyboard, focus, nesting, dismissal, and controlled state", async ({ page }) => {
    await exerciseModal(page, "dialog");
  });

  test("Sheet keyboard, focus, nesting, dismissal, and controlled state", async ({ page }) => {
    await exerciseModal(page, "sheet");
  });

  test("Menu navigation, controlled checkbox, focus restoration, and dismissal", async ({
    page,
  }) => {
    const trigger = page.locator('[data-catalog-probe="menu"] [data-ds-part="trigger"]');
    await prepareAnchoredTarget(page, trigger);
    await page.keyboard.press("ArrowDown");
    const menu = page.locator('[data-ds-component="menu"][data-ds-part="content"]');
    const items = menu.locator('[data-ds-part="item"]');
    await expect(items).toHaveCount(4);
    await expect(items.first()).toBeFocused();
    await expectReducedMotion(menu);

    await page.keyboard.press("End");
    await expect(items.last()).toBeFocused();
    await expect(items.last()).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Home");
    await expect(items.first()).toBeFocused();
    const typeahead = (await items.nth(2).innerText()).trim().slice(0, 1);
    expect(typeahead).not.toBe("");
    await page.keyboard.type(typeahead);
    await expect(items.nth(2)).toBeFocused();
    await expect(items.nth(2)).toHaveAttribute("role", "menuitemcheckbox");
    await expect(items.nth(2)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Space");
    await expect(items.nth(2)).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Space");
    await expect(items.nth(2)).toHaveAttribute("aria-checked", "true");
    await expectForcedColorEquivalent(page, menu);

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(menu).toBeHidden();
    await expect(page.locator('[data-catalog-probe="tooltip"] [data-ds-part="trigger"]'))
      .toBeFocused();
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(1, 1);
    await expect(menu).toBeHidden();
  });

  test("Combobox navigation, selection, portal, focus, and dismissal", async ({ page }) => {
    const probe = page.locator('[data-catalog-probe="combobox-ready"]');
    const input = probe.locator('[data-ds-part="input"]');
    await prepareAnchoredTarget(page, input);
    await page.keyboard.press("ArrowDown");
    const popup = page.locator(
      '[data-ds-component="combobox"][data-ds-part="content"][data-state="open"]',
    );
    const options = popup.getByRole("option");
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(input).toBeFocused();
    await expect(options).toHaveCount(3);
    await expect(input).toHaveAttribute("aria-activedescendant", /.+/u);
    expect(await input.evaluate((element) => {
      const controls = element.getAttribute("aria-controls");
      const active = element.getAttribute("aria-activedescendant");
      const controlledElement = controls ? document.getElementById(controls) : null;
      const activeElement = active ? document.getElementById(active) : null;
      return Boolean(
        controlledElement?.getAttribute("role") === "listbox" &&
        activeElement?.getAttribute("role") === "option" &&
        controlledElement.contains(activeElement),
      );
    })).toBe(true);
    await expectReducedMotion(popup);
    expect(await popup.evaluate((element) => {
      const portalRoot = element.closest<HTMLElement>("[data-ds-portal-root]");
      const host = portalRoot?.parentElement;
      return Boolean(
        host?.hasAttribute("data-ds-overlay-host") &&
        host.closest("main[data-design-system='v2']"),
      );
    })).toBe(true);

    await page.keyboard.press("ArrowDown");
    const selectedLabel = (await options.nth(1).innerText()).trim();
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(input).toHaveValue(selectedLabel);
    await page.keyboard.press("ArrowDown");
    await expect(popup.getByRole("option", { selected: true })).toHaveCount(1);
    await expectForcedColorEquivalent(page, popup);
    await page.keyboard.press("Escape");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await input.click();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await page.mouse.click(1, 1);
    await expect(input).toHaveAttribute("aria-expanded", "false");
  });

  test("Tabs manual activation, roving focus, RTL, and non-color state", async ({ page }) => {
    const probe = page.locator('[data-catalog-probe="tabs"]');
    const tabs = probe.locator('[data-ds-component="tabs"]');
    const items = tabs.locator('[data-ds-part="tab"]');
    await expectReducedMotion(tabs);
    await items.first().focus();
    await expect(items.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(items.nth(1)).toBeFocused();
    await expect(items.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Space");
    await expect(items.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.locator('[data-ds-part="tabpanel"]:visible')).toHaveCount(1);
    expect(await items.evaluateAll((elements) =>
      elements.filter((element) => element.getAttribute("tabindex") === "0").length
    )).toBe(1);

    await page.keyboard.press("End");
    await expect(items.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(items.first()).toBeFocused();
    await probe.evaluate((element) => element.setAttribute("dir", "rtl"));
    await items.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(items.last()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(items.last()).toHaveAttribute("aria-selected", "true");

    await expectForcedColorEquivalent(page, tabs);
    await expect(items.last()).toHaveAttribute("data-state", "active");
    await expect(items.last()).toHaveAttribute("aria-selected", "true");
    await expect(tabs.locator('[data-ds-part="tabpanel"]:visible')).toHaveCount(1);
    expect(await tabs.evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>('[role="tab"]')].every((tab) => {
        const panelId = tab.getAttribute("aria-controls");
        const panel = panelId ? document.getElementById(panelId) : null;
        return Boolean(panel && panel.getAttribute("aria-labelledby") === tab.id);
      })
    )).toBe(true);
  });
});
