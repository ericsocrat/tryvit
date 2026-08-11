import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { anchoredPopupStyle } from "./anchored-position";
import { portalScopeAttributes, resolvePortalHost, ScopedPortal } from "./portal";
import { adjacentTabStop } from "./dom";
import { lockDocumentScroll } from "./scroll-lock";

const html = document.documentElement;
const originalHtmlAttributes = {
  direction: html.getAttribute("dir"),
  language: html.getAttribute("lang"),
  theme: html.getAttribute("data-theme"),
};

function restoreAttribute(name: string, value: string | null) {
  if (value === null) html.removeAttribute(name);
  else html.setAttribute(name, value);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restoreAttribute("dir", originalHtmlAttributes.direction);
  restoreAttribute("lang", originalHtmlAttributes.language);
  restoreAttribute("data-theme", originalHtmlAttributes.theme);
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

describe("V2 portal and overlay helpers", () => {
  it("copies local theme, direction, and language scope", () => {
    const scope = document.createElement("section");
    scope.dataset.theme = "dark";
    scope.dir = "rtl";
    scope.lang = "pl";
    const anchor = document.createElement("button");
    scope.append(anchor);
    document.body.append(scope);

    expect(portalScopeAttributes(anchor)).toEqual({
      "data-design-system": "v2",
      "data-theme": "dark",
      dir: "rtl",
      lang: "pl",
    });
    scope.remove();
  });

  it("uses an explicit effective LTR fallback and omits an empty language", () => {
    html.removeAttribute("dir");
    html.removeAttribute("lang");
    html.removeAttribute("data-theme");
    const anchor = document.createElement("button");
    document.body.append(anchor);

    expect(portalScopeAttributes(anchor)).toEqual({
      "data-design-system": "v2",
      dir: "ltr",
    });
    anchor.remove();
  });

  it("targets the nearest open dialog overlay host", () => {
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    const host = document.createElement("div");
    host.dataset.dsOverlayHost = "";
    const anchor = document.createElement("button");
    dialog.append(anchor, host);
    document.body.append(dialog);

    expect(resolvePortalHost(anchor)).toBe(host);
    dialog.remove();
  });

  it("keeps portalled menu Tab destinations inside the nearest modal", () => {
    const outside = document.createElement("button");
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    const first = document.createElement("button");
    const trigger = document.createElement("button");
    const last = document.createElement("button");
    dialog.append(first, trigger, last);
    document.body.append(outside, dialog);

    expect(adjacentTabStop(trigger, false)).toBe(last);
    expect(adjacentTabStop(trigger, true)).toBe(first);
    expect(adjacentTabStop(last, false)).toBe(first);
    expect(adjacentTabStop(first, true)).toBe(last);
    expect(adjacentTabStop(last, false)).not.toBe(outside);
    dialog.remove();
    outside.remove();
  });

  it("renders an explicitly scoped portal root", () => {
    const anchor = document.createElement("button");
    const scope = document.createElement("section");
    scope.dataset.theme = "light";
    scope.dir = "ltr";
    scope.lang = "en";
    scope.append(anchor);
    document.body.append(scope);

    render(
      <ScopedPortal anchor={anchor}>
        <span>Portalled content</span>
      </ScopedPortal>,
    );

    const content = screen.getByText("Portalled content");
    const portalRoot = content.closest("[data-ds-portal-root]");
    expect(portalRoot).toHaveAttribute("data-design-system", "v2");
    expect(portalRoot).toHaveAttribute("data-theme", "light");
    expect(portalRoot).toHaveAttribute("dir", "ltr");
    expect(portalRoot).toHaveAttribute("lang", "en");
    scope.remove();
  });

  it("keeps scroll locked until the final lock for a document is released", () => {
    document.body.style.overflow = "auto";
    const releaseFirst = lockDocumentScroll(document);
    const releaseSecond = lockDocumentScroll(document);
    expect(document.body.style.overflow).toBe("hidden");

    releaseFirst();
    expect(document.body.style.overflow).toBe("hidden");
    releaseSecond();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("clamps an anchored popup to the real width remaining at its final position", () => {
    const anchor = document.createElement("button");
    document.body.append(anchor);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(800);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 140,
      height: 40,
      left: 500,
      right: 600,
      top: 100,
      width: 100,
      x: 500,
      y: 100,
      toJSON: () => ({}),
    });

    expect(anchoredPopupStyle(anchor)).toMatchObject({ left: 500, maxWidth: 292 });
    expect(anchoredPopupStyle(anchor, { matchWidth: true })).toMatchObject({
      left: 500,
      minWidth: 100,
      maxWidth: 292,
    });
    expect(anchoredPopupStyle(anchor, { minimumWidth: 400 })).toMatchObject({
      left: 500,
      minWidth: 292,
      maxWidth: 292,
    });
    anchor.remove();
  });

  it("never makes an anchored popup taller than the actual viewport room", () => {
    const anchor = document.createElement("button");
    document.body.append(anchor);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(320);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(120);
    const rectangle = vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 75,
      height: 30,
      left: 20,
      right: 120,
      top: 45,
      width: 100,
      x: 20,
      y: 45,
      toJSON: () => ({}),
    });

    expect(anchoredPopupStyle(anchor)).toMatchObject({
      maxHeight: 33,
      top: 79,
    });
    rectangle.mockReturnValue({
      bottom: 110,
      height: 20,
      left: 20,
      right: 120,
      top: 90,
      width: 100,
      x: 20,
      y: 90,
      toJSON: () => ({}),
    });
    expect(anchoredPopupStyle(anchor)).toMatchObject({
      bottom: 34,
      maxHeight: 78,
    });
    anchor.remove();
  });

  it("clamps anchored popups to an offset visual viewport above a virtual keyboard", () => {
    const anchor = document.createElement("button");
    document.body.append(anchor);
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(800);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(900);
    vi.stubGlobal("visualViewport", {
      height: 300,
      offsetLeft: 40,
      offsetTop: 200,
      width: 280,
    } as VisualViewport);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      bottom: 390,
      height: 40,
      left: 250,
      right: 350,
      top: 350,
      width: 100,
      x: 250,
      y: 350,
      toJSON: () => ({}),
    });

    expect(anchoredPopupStyle(anchor)).toMatchObject({
      bottom: 554,
      left: 72,
      maxHeight: 138,
      maxWidth: 240,
    });
    anchor.remove();
  });

  it("keeps explicit client boundaries limited to interactive entry modules", () => {
    const primitivesRoot = resolve(process.cwd(), "src/design-system/primitives");
    const explicitClientFiles = sourceFiles(primitivesRoot)
      .filter((path) => /\.(?:ts|tsx)$/u.test(path))
      .filter((path) => readFileSync(path, "utf8").startsWith('"use client";'))
      .map((path) => path.slice(primitivesRoot.length + 1).replaceAll("\\", "/"))
      .sort();

    expect(explicitClientFiles).toEqual([
      "Combobox/Combobox.tsx",
      "Field/IndeterminateCheckbox.client.tsx",
      "Menu/Menu.tsx",
      "Overlay/Overlay.tsx",
      "Tabs/Tabs.tsx",
      "Tooltip/Tooltip.tsx",
    ]);
  });
});
