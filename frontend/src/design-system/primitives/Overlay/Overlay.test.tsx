import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useRef, useState } from "react";
import { axe } from "vitest-axe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Menu } from "@/design-system/primitives/Menu";

import { Dialog, type OverlayCloseReason } from "./Overlay";

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
const nestedPopupEntries = [{
  id: "review-source",
  label: "Review source",
  textValue: "Review source",
  onSelect: () => undefined,
}] as const;

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
  dismissible = true,
}: Readonly<{
  onChange?: (open: boolean, reason: OverlayCloseReason) => void;
  dismissible?: boolean;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <section data-design-system="v2" data-theme="dark" dir="rtl" lang="pl">
      <button type="button" onClick={() => setOpen(true)}>Open review</button>
      <Dialog
        open={open}
        title="Review evidence"
        description="Check the source before confirming."
        closeLabel="Close review"
        dismissible={dismissible}
        onOpenChange={(nextOpen, reason) => {
          onChange(nextOpen, reason);
          setOpen(nextOpen);
        }}
      >
        <button type="button">Confirm evidence</button>
      </Dialog>
    </section>
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
    await waitFor(() => expect(screen.getByRole("heading", { name: "Review evidence" }))
      .toHaveFocus());
    const portalRoot = dialog.closest("[data-ds-portal-root]");
    expect(portalRoot).toHaveAttribute("data-design-system", "v2");
    expect(portalRoot).toHaveAttribute("data-theme", "dark");
    expect(portalRoot).toHaveAttribute("dir", "rtl");
    expect(portalRoot).toHaveAttribute("lang", "pl");
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
          <button type="button" onClick={() => setOpen(true)}>Open parent modal</button>
          <Dialog
            open={open}
            title="Parent modal"
            closeLabel="Close parent modal"
            onOpenChange={(nextOpen, reason) => {
              outerChange(nextOpen, reason);
              setOpen(nextOpen);
            }}
          >
            <Menu
              entries={nestedPopupEntries}
              triggerLabel="Open nested actions"
            />
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
            <button type="button" onClick={() => setOpen(false)}>Finish workflow</button>
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
          <button type="button" onClick={() => setOuterOpen(true)}>Open outer</button>
          <Dialog
            open={outerOpen}
            title="Outer dialog"
            closeLabel="Close outer"
            onOpenChange={(next, reason) => {
              outerChange(next, reason);
              setOuterOpen(next);
            }}
          >
            <button type="button" onClick={() => setInnerOpen(true)}>Open inner</button>
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
    await user.click(within(outer).getByRole("button", { name: "Open inner" }));
    const inner = screen.getByRole("dialog", { name: "Inner dialog" });
    const outerHost = outer.querySelector("[data-ds-overlay-host]");
    expect(outerHost).toContainElement(inner.closest("[data-ds-portal-root]"));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent(inner, new Event("cancel", { cancelable: true }));
    expect(innerChange).toHaveBeenLastCalledWith(false, "escape");
    expect(outerChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Outer dialog" })).toBeVisible();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("has no detectable accessibility violations in an open modal", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open review" }));
    await screen.findByRole("dialog", { name: "Review evidence" });
    expect((await axe(document.body)).violations).toHaveLength(0);
  });
});
