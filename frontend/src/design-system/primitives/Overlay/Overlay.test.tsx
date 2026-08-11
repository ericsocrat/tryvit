import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, createElement, useLayoutEffect, useRef, useState } from "react";
import { axe } from "vitest-axe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Menu } from "@/design-system/primitives/Menu";
import { claimOverlayPointerDismissal } from "@/design-system/primitives/shared/overlay-stack";

import {
  Dialog,
  Sheet,
  assertSupportedModalFocusScope,
  type ModalOverlayProps,
  type OverlayCloseReason,
} from "./Overlay";

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
const nestedPopupEntries = [
  {
    id: "review-source",
    label: "Review source",
    textValue: "Review source",
    onSelect: () => undefined,
  },
] as const;

function markRendered(...elements: readonly Element[]): void {
  const rectangle = {
    bottom: 40,
    height: 32,
    left: 8,
    right: 120,
    top: 8,
    width: 112,
    x: 8,
    y: 8,
    toJSON: () => ({}),
  } as DOMRect;
  const rectangles = {
    0: rectangle,
    item: (index: number) => (index === 0 ? rectangle : null),
    length: 1,
  } as DOMRectList;
  elements.forEach((element) => {
    vi.spyOn(element, "getClientRects").mockReturnValue(rectangles);
  });
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterAll(() => {
  if (originalShowModal) HTMLDialogElement.prototype.showModal = originalShowModal;
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  if (originalClose) HTMLDialogElement.prototype.close = originalClose;
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

function Harness({
  onChange = vi.fn(),
  onKeyDown,
  dismissible = true,
  kind = "dialog",
}: Readonly<{
  onChange?: (open: boolean, reason: OverlayCloseReason) => void;
  onKeyDown?: ModalOverlayProps["onKeyDown"];
  dismissible?: boolean;
  kind?: "dialog" | "sheet";
}>) {
  const [open, setOpen] = useState(false);
  const Overlay = kind === "dialog" ? Dialog : Sheet;
  return (
    <section data-design-system="v2" data-theme="dark" dir="rtl" lang="pl">
      <button type="button" onClick={() => setOpen(true)}>
        Open review
      </button>
      <Overlay
        open={open}
        title="Review evidence"
        description="Check the source before confirming."
        closeLabel="Close review"
        dismissible={dismissible}
        onKeyDown={onKeyDown}
        onOpenChange={(nextOpen, reason) => {
          onChange(nextOpen, reason);
          setOpen(nextOpen);
        }}
      >
        <button type="button">Confirm evidence</button>
      </Overlay>
    </section>
  );
}

function ProgrammaticFocusHarness() {
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open summary review
      </button>
      <Dialog
        closeLabel="Close summary review"
        initialFocusRef={summaryRef}
        onOpenChange={setOpen}
        open={open}
        title="Summary review"
      >
        <button type="button">Before summary</button>
        <div ref={summaryRef} tabIndex={-1}>
          Validation summary
        </div>
        <button type="button">After summary</button>
      </Dialog>
    </>
  );
}

function IframeBoundaryHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open iframe review
      </button>
      <Dialog
        closeLabel="Close iframe review"
        onOpenChange={setOpen}
        open={open}
        title="Iframe review"
      >
        <iframe title="Embedded evidence" />
      </Dialog>
    </>
  );
}

function SvgInvokerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {createElement(
        "svg",
        null,
        createElement(
          "a",
          {
            "aria-label": "Open vector review",
            href: "#vector-review",
            onClick: (event) => {
              event.preventDefault();
              setOpen(true);
            },
            tabIndex: 0,
          },
          createElement("text", null, "Open vector review"),
        ),
      )}
      <Dialog
        closeLabel="Close vector review"
        onOpenChange={setOpen}
        open={open}
        title="Vector review"
      >
        Vector evidence
      </Dialog>
    </>
  );
}

function MathMlInvokerHarness() {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const math = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math");
    const invoker = document.createElementNS(
      "http://www.w3.org/1998/Math/MathML",
      "annotation-xml",
    );
    invoker.setAttribute("aria-label", "Open formula review");
    invoker.setAttribute("role", "button");
    invoker.setAttribute("tabindex", "0");
    const openDialog = () => setOpen(true);
    invoker.addEventListener("click", openDialog);
    math.append(invoker);
    host.append(math);
    return () => {
      invoker.removeEventListener("click", openDialog);
      math.remove();
    };
  }, []);

  return (
    <>
      <span ref={hostRef} />
      <Dialog
        closeLabel="Close formula review"
        onOpenChange={setOpen}
        open={open}
        title="Formula review"
      >
        Formula evidence
      </Dialog>
    </>
  );
}

describe("V2 native modal overlays", () => {
  it("keeps dialog and sheet bounds on the shared safe-area contract", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/design-system/primitives/Overlay/overlay.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.sheet\s*\{[^}]*max-width:\s*var\(--overlay-safe-inline-size\)/su);
    expect(css).toMatch(/\.sheet\s*\{[^}]*var\(--overlay-safe-block-size\)/su);
  });

  it("portals inherited V2 scope, opens modally, labels itself, and focuses its heading", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open review" }));

    const dialog = screen.getByRole("dialog", { name: "Review evidence" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Review evidence" })).toHaveFocus(),
    );
    const portalRoot = dialog.closest("[data-ds-portal-root]");
    expect(portalRoot).toHaveAttribute("data-design-system", "v2");
    expect(portalRoot).toHaveAttribute("data-theme", "dark");
    expect(portalRoot).toHaveAttribute("dir", "rtl");
    expect(portalRoot).toHaveAttribute("lang", "pl");
  });

  it.each(["dialog", "sheet"] as const)(
    "wraps one forward and reverse Tab at the %s boundary while composing onKeyDown",
    async (kind) => {
      const user = userEvent.setup();
      const onTabKeyDown = vi.fn();
      render(
        <Harness
          kind={kind}
          onKeyDown={(event) => {
            if (event.key === "Tab") onTabKeyDown();
          }}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Open review" }));

      const overlay = screen.getByRole("dialog", { name: "Review evidence" });
      const heading = within(overlay).getByRole("heading", { name: "Review evidence" });
      const close = within(overlay).getByRole("button", { name: "Close review" });
      const last = within(overlay).getByRole("button", { name: "Confirm evidence" });
      markRendered(close, last);
      await waitFor(() => expect(heading).toHaveFocus());

      await user.tab({ shift: true });
      expect(last).toHaveFocus();
      heading.focus();
      await user.tab();
      expect(close).toHaveFocus();
      last.focus();

      await user.tab();
      expect(close).toHaveFocus();
      await user.tab({ shift: true });
      expect(last).toHaveFocus();
      expect(onTabKeyDown).toHaveBeenCalledTimes(4);
    },
  );

  it("preserves DOM-adjacent Tab order from a contained programmatic focus target", async () => {
    const user = userEvent.setup();
    render(<ProgrammaticFocusHarness />);
    await user.click(screen.getByRole("button", { name: "Open summary review" }));

    const overlay = screen.getByRole("dialog", { name: "Summary review" });
    const before = within(overlay).getByRole("button", { name: "Before summary" });
    const summary = within(overlay).getByText("Validation summary");
    const after = within(overlay).getByRole("button", { name: "After summary" });
    const close = within(overlay).getByRole("button", { name: "Close summary review" });
    markRendered(close, before, after);
    await waitFor(() => expect(summary).toHaveFocus());

    await user.tab();
    expect(after).toHaveFocus();
    summary.focus();
    await user.tab({ shift: true });
    expect(before).toHaveFocus();
  });

  it("uses its end guard when a nested browsing context cannot bubble Tab", async () => {
    const user = userEvent.setup();
    render(<IframeBoundaryHarness />);
    await user.click(screen.getByRole("button", { name: "Open iframe review" }));

    const overlay = screen.getByRole("dialog", { name: "Iframe review" });
    const close = within(overlay).getByRole("button", { name: "Close iframe review" });
    const iframe = within(overlay).getByTitle("Embedded evidence");
    const guard = overlay.querySelector<HTMLElement>("[data-ds-focus-guard='end']");
    expect(guard).not.toBeNull();
    markRendered(close, iframe);

    guard?.focus();
    expect(close).toHaveFocus();
  });

  it("restores a connected focusable SVG invoker", async () => {
    const user = userEvent.setup();
    render(<SvgInvokerHarness />);
    const invoker = screen.getByRole("link", { name: "Open vector review" });
    invoker.focus();
    fireEvent.click(invoker);
    await user.click(await screen.findByRole("button", { name: "Close vector review" }));

    await waitFor(() => expect(invoker).toHaveFocus());
  });

  it("restores a connected focusable MathML invoker", async () => {
    render(<MathMlInvokerHarness />);
    const invoker = document.querySelector<Element>(
      '[aria-label="Open formula review"]',
    );
    expect(invoker).not.toBeNull();
    if (!invoker) throw new Error("MathML invoker missing");
    const focus = vi.fn();
    Object.defineProperties(invoker, {
      focus: { configurable: true, value: focus },
      tabIndex: { configurable: true, value: 0 },
    });
    const getComputedStyle = window.getComputedStyle.bind(window);
    const fallbackStyle = getComputedStyle(document.body);
    const computedStyleSpy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element, pseudoElement) =>
        element === invoker ? fallbackStyle : getComputedStyle(element, pseudoElement),
      );
    const ownActiveElement = Object.getOwnPropertyDescriptor(document, "activeElement");
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => invoker,
    });
    try {
      fireEvent.click(invoker);
      const close = await waitFor(() => {
        const element = document.querySelector<HTMLButtonElement>(
          'dialog [data-ds-part="close"]',
        );
        expect(element).not.toBeNull();
        return element;
      });
      if (!close) throw new Error("MathML dialog close action missing");
      if (ownActiveElement) {
        Object.defineProperty(document, "activeElement", ownActiveElement);
      } else {
        delete (document as Document & { activeElement?: Element | null }).activeElement;
      }
      fireEvent.click(close);
      await waitFor(() => expect(focus).toHaveBeenCalled());
    } finally {
      computedStyleSpy.mockRestore();
      if (ownActiveElement) {
        Object.defineProperty(document, "activeElement", ownActiveElement);
      } else {
        delete (document as Document & { activeElement?: Element | null }).activeElement;
      }
    }
  });

  it("rejects positive tab order inside the modal focus scope", () => {
    const dialog = document.createElement("dialog");
    const positive = document.createElement("button");
    positive.tabIndex = 1;
    dialog.append(positive);
    document.body.append(dialog);
    markRendered(positive);

    expect(() => assertSupportedModalFocusScope(dialog)).toThrow(
      "Dialog and Sheet do not accept positive tabIndex descendants.",
    );
    dialog.remove();
  });

  it("rejects consumer shadow-root focus scopes", () => {
    const dialog = document.createElement("dialog");
    const shadowHost = document.createElement("div");
    shadowHost.attachShadow({ mode: "open" }).append(document.createElement("button"));
    dialog.append(shadowHost);

    expect(() => assertSupportedModalFocusScope(dialog)).toThrow(
      "Dialog and Sheet do not accept consumer custom-element or shadow-root focus scopes.",
    );
  });

  it("revalidates a dynamically attached open shadow root before Tab traversal", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open review" }));
    const dialog = await screen.findByRole("dialog", { name: "Review evidence" });
    const host = document.createElement("div");
    host.tabIndex = 0;
    dialog.append(host);
    host.focus();
    host.attachShadow({ mode: "open" }).append(document.createElement("button"));
    const errors: Error[] = [];
    const captureError = (event: ErrorEvent) => {
      if (event.error instanceof Error) errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", captureError);
    try {
      fireEvent.keyDown(host, { key: "Tab" });
      await waitFor(() =>
        expect(errors.map((error) => error.message)).toContain(
          "Dialog and Sheet do not accept consumer custom-element or shadow-root focus scopes.",
        ),
      );
    } finally {
      window.removeEventListener("error", captureError);
    }
  });

  it("does not misclassify standard hyphenated non-HTML elements as custom elements", () => {
    const dialog = document.createElement("dialog");
    const annotation = document.createElementNS(
      "http://www.w3.org/1998/Math/MathML",
      "annotation-xml",
    );
    dialog.append(annotation);

    expect(() => assertSupportedModalFocusScope(dialog)).not.toThrow();
  });

  it("reports close-button and Escape reasons and restores the invoker", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Open review" });

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Close review" }));
    expect(onChange).toHaveBeenLastCalledWith(false, "close-button");
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Review evidence" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onChange).toHaveBeenLastCalledWith(false, "escape");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("requires both primary pointer down and up on the backdrop", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Open review" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Review evidence" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 200,
      left: 100,
      right: 300,
      top: 100,
      width: 200,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(dialog, { button: 0, pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(dialog, { button: 0, pointerId: 1, clientX: 150, clientY: 150 });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(dialog, { button: 0, pointerId: 2, clientX: 20, clientY: 20 });
    fireEvent.pointerCancel(dialog, { pointerId: 2 });
    fireEvent.pointerUp(dialog, { button: 0, pointerId: 2, clientX: 20, clientY: 20 });
    expect(onChange).not.toHaveBeenCalled();

    const claimedPointerDown = new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 20,
      clientY: 20,
      pointerId: 4,
    });
    claimOverlayPointerDismissal(claimedPointerDown);
    fireEvent(dialog, claimedPointerDown);
    fireEvent.pointerUp(dialog, { button: 0, pointerId: 4, clientX: 20, clientY: 20 });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(dialog, { button: 0, pointerId: 3, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(dialog, { button: 0, pointerId: 3, clientX: 20, clientY: 20 });
    expect(onChange).toHaveBeenLastCalledWith(false, "outside-pointer");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("does not cascade a nested popup outside-pointer gesture into its parent modal", async () => {
    const user = userEvent.setup();
    const outerChange = vi.fn();

    function NestedPopupHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open parent modal
          </button>
          <Dialog
            open={open}
            title="Parent modal"
            closeLabel="Close parent modal"
            onOpenChange={(nextOpen, reason) => {
              outerChange(nextOpen, reason);
              setOpen(nextOpen);
            }}
          >
            <Menu entries={nestedPopupEntries} triggerLabel="Open nested actions" />
          </Dialog>
        </>
      );
    }

    render(<NestedPopupHarness />);
    await user.click(screen.getByRole("button", { name: "Open parent modal" }));
    const dialog = screen.getByRole("dialog", { name: "Parent modal" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 200,
      left: 100,
      right: 300,
      top: 100,
      width: 200,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    await user.click(within(dialog).getByRole("button", { name: "Open nested actions" }));
    await screen.findByRole("menu");

    fireEvent.pointerDown(dialog, {
      button: 0,
      pointerId: 41,
      clientX: 20,
      clientY: 20,
    });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.pointerUp(dialog, {
      button: 0,
      pointerId: 41,
      clientX: 20,
      clientY: 20,
    });

    expect(outerChange).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();
  });

  it("restores native programmatic closes and honors non-dismissible Escape", async () => {
    const user = userEvent.setup();
    const programmaticChange = vi.fn();
    const { unmount } = render(<Harness onChange={programmaticChange} />);
    const programmaticTrigger = screen.getByRole("button", { name: "Open review" });
    await user.click(programmaticTrigger);
    act(() => screen.getByRole("dialog", { name: "Review evidence" }).close());
    expect(programmaticChange).toHaveBeenLastCalledWith(false, "programmatic");
    await waitFor(() => expect(programmaticTrigger).toHaveFocus());
    unmount();

    const blockedChange = vi.fn();
    render(<Harness dismissible={false} onChange={blockedChange} />);
    await user.click(screen.getByRole("button", { name: "Open review" }));
    fireEvent(
      screen.getByRole("dialog", { name: "Review evidence" }),
      new Event("cancel", { cancelable: true }),
    );
    expect(blockedChange).not.toHaveBeenCalled();
  });

  it("re-arms programmatic close reporting after Strict Mode replays its lifecycle", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <StrictMode>
        <Harness onChange={onChange} />
      </StrictMode>,
    );

    await user.click(screen.getByRole("button", { name: "Open review" }));
    const dialog = screen.getByRole("dialog", { name: "Review evidence" });
    onChange.mockClear();

    act(() => dialog.close());

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(false, "programmatic");
  });

  it("restores a programmatic close only when an explicit connected target is supplied", async () => {
    const user = userEvent.setup();

    function ExplicitRestoreHarness() {
      const [open, setOpen] = useState(false);
      const restoreRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={restoreRef} type="button" onClick={() => setOpen(true)}>
            Explicit restore target
          </button>
          <Dialog
            open={open}
            title="Programmatic dialog"
            closeLabel="Close programmatic dialog"
            restoreFocusRef={restoreRef}
            onOpenChange={setOpen}
          >
            <button type="button" onClick={() => setOpen(false)}>
              Finish workflow
            </button>
          </Dialog>
        </>
      );
    }

    render(<ExplicitRestoreHarness />);
    const trigger = screen.getByRole("button", { name: "Explicit restore target" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Finish workflow" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("places a nested modal portal in the nearest host and only dismisses the top dialog", async () => {
    const user = userEvent.setup();
    const outerChange = vi.fn();
    const innerChange = vi.fn();

    function NestedHarness() {
      const [outerOpen, setOuterOpen] = useState(false);
      const [innerOpen, setInnerOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOuterOpen(true)}>
            Open outer
          </button>
          <Dialog
            open={outerOpen}
            title="Outer dialog"
            closeLabel="Close outer"
            onOpenChange={(next, reason) => {
              outerChange(next, reason);
              setOuterOpen(next);
            }}
          >
            <button type="button" onClick={() => setInnerOpen(true)}>
              Open inner
            </button>
            <Dialog
              open={innerOpen}
              title="Inner dialog"
              closeLabel="Close inner"
              onOpenChange={(next, reason) => {
                innerChange(next, reason);
                setInnerOpen(next);
              }}
            >
              Nested content
            </Dialog>
          </Dialog>
        </>
      );
    }

    render(<NestedHarness />);
    await user.click(screen.getByRole("button", { name: "Open outer" }));
    const outer = screen.getByRole("dialog", { name: "Outer dialog" });
    const innerTrigger = within(outer).getByRole("button", { name: "Open inner" });
    const outerClose = within(outer).getByRole("button", { name: "Close outer" });
    markRendered(innerTrigger, outerClose);
    await user.click(innerTrigger);
    const inner = screen.getByRole("dialog", { name: "Inner dialog" });
    const outerHost = outer.querySelector("[data-ds-overlay-host]");
    expect(outerHost).toContainElement(inner.closest("[data-ds-portal-root]"));
    expect(document.body.style.overflow).toBe("hidden");

    const innerClose = within(inner).getByRole("button", { name: "Close inner" });
    markRendered(innerClose);
    innerClose.focus();
    await user.tab();
    expect(innerClose).toHaveFocus();

    fireEvent(inner, new Event("cancel", { cancelable: true }));
    expect(innerChange).toHaveBeenLastCalledWith(false, "escape");
    expect(outerChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Outer dialog" })).toBeVisible();
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() => expect(innerTrigger).toHaveFocus());
    await user.tab();
    expect(outerClose).toHaveFocus();
  });

  it("has no detectable accessibility violations in an open modal", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open review" }));
    await screen.findByRole("dialog", { name: "Review evidence" });
    expect((await axe(document.body)).violations).toHaveLength(0);
  });
});
