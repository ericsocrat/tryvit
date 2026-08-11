import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { claimOverlayPointerDismissal } from "@/design-system/primitives/shared/overlay-stack";

import { Menu, type MenuEntry } from "./Menu";

function entries(
  callbacks: {
    alpha?: () => void;
    beta?: () => void;
    gamma?: () => void;
    checked?: (checked: boolean) => void;
  } = {},
): MenuEntry[] {
  return [
    {
      id: "alpha",
      label: "Alpha source",
      textValue: "Alpha source",
      onSelect: callbacks.alpha ?? vi.fn(),
    },
    {
      id: "beta",
      label: "Beta source unavailable",
      textValue: "Beta source unavailable",
      disabled: true,
      onSelect: callbacks.beta ?? vi.fn(),
    },
    { id: "separator", type: "separator" },
    {
      id: "gamma",
      label: "Gamma source",
      textValue: "Gamma source",
      onSelect: callbacks.gamma ?? vi.fn(),
    },
    {
      id: "context",
      type: "checkbox",
      label: "Include context",
      textValue: "Include context",
      checked: false,
      onCheckedChange: callbacks.checked ?? vi.fn(),
    },
  ];
}

function markRendered(...elements: readonly HTMLElement[]): void {
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

describe("V2 Menu", () => {
  it("supports wrapped arrows, Home/End, typeahead, and focusable disabled items", async () => {
    const user = userEvent.setup();
    const beta = vi.fn();
    render(<Menu triggerLabel="Evidence actions" entries={entries({ beta })} />);
    const trigger = screen.getByRole("button", { name: "Evidence actions" });
    await user.click(trigger);

    const alpha = screen.getByRole("menuitem", { name: "Alpha source" });
    const disabled = screen.getByRole("menuitem", { name: "Beta source unavailable" });
    const gamma = screen.getByRole("menuitem", { name: "Gamma source" });
    await waitFor(() => expect(alpha).toHaveFocus());

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitemcheckbox", { name: "Include context" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(alpha).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(disabled).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(beta).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();

    await user.keyboard("{End}");
    expect(screen.getByRole("menuitemcheckbox", { name: "Include context" })).toHaveFocus();
    await user.keyboard("g");
    expect(gamma).toHaveFocus();
  });

  it("keeps checkbox menus open and restores the trigger on Escape", async () => {
    const user = userEvent.setup();
    const checked = vi.fn();
    function CheckboxHarness() {
      const [isChecked, setIsChecked] = useState(false);
      return (
        <Menu
          triggerLabel="Evidence actions"
          entries={entries({
            checked: (nextChecked) => {
              checked(nextChecked);
              setIsChecked(nextChecked);
            },
          }).map((entry) => (entry.type === "checkbox" ? { ...entry, checked: isChecked } : entry))}
        />
      );
    }
    render(<CheckboxHarness />);
    const trigger = screen.getByRole("button", { name: "Evidence actions" });
    await user.click(trigger);
    const checkbox = screen.getByRole("menuitemcheckbox", { name: "Include context" });
    const indicator = checkbox.querySelector("[data-ds-part='checkbox-indicator']");
    expect(indicator).toHaveAttribute("data-state", "unchecked");
    expect(indicator?.querySelector("svg")).toBeNull();

    await user.click(checkbox);
    expect(checked).toHaveBeenCalledWith(true);
    expect(screen.getByRole("menu")).toBeVisible();
    expect(checkbox).toHaveAttribute("aria-checked", "true");
    expect(indicator).toHaveAttribute("data-state", "checked");
    expect(indicator?.querySelector("svg[aria-hidden='true']")).not.toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("moves forward and backward to the page tab stops adjacent to its portalled trigger", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before menu</button>
        <Menu triggerLabel="Evidence actions" entries={entries()} />
        <button type="button" tabIndex={-1}>
          Programmatic-only stop
        </button>
        <button type="button">After menu</button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Evidence actions" });
    const before = screen.getByRole("button", { name: "Before menu" });
    const after = screen.getByRole("button", { name: "After menu" });
    markRendered(before, trigger, after);
    const beforeFocus = vi.spyOn(before, "focus");
    const afterFocus = vi.spyOn(after, "focus");

    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Alpha source" })).toHaveFocus(),
    );
    await user.tab();
    await waitFor(() => expect(after).toHaveFocus());
    expect(afterFocus).toHaveBeenCalledWith({ preventScroll: false });
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Alpha source" })).toHaveFocus(),
    );
    await user.tab({ shift: true });
    await waitFor(() => expect(before).toHaveFocus());
    expect(beforeFocus).toHaveBeenCalledWith({ preventScroll: false });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes and reanchors on the trigger at a document-edge Tab", async () => {
    const user = userEvent.setup();
    render(<Menu triggerLabel="Evidence actions" entries={entries()} />);
    const trigger = screen.getByRole("button", { name: "Evidence actions" });
    await user.click(trigger);
    const firstItem = screen.getByRole("menuitem", { name: "Alpha source" });
    await waitFor(() => expect(firstItem).toHaveFocus());
    const triggerFocus = vi.spyOn(trigger, "focus");

    expect(fireEvent.keyDown(firstItem, { key: "Tab", metaKey: true })).toBe(true);
    expect(screen.getByRole("menu")).toBeVisible();
    expect(fireEvent.keyDown(firstItem, { key: "Tab" })).toBe(false);
    expect(triggerFocus).toHaveBeenCalledWith({ preventScroll: true });
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("honors an ancestor capture veto for Tab handoff", async () => {
    const user = userEvent.setup();
    render(
      <div
        onKeyDownCapture={(event) => {
          if (event.key === "Tab") event.preventDefault();
        }}
      >
        <Menu triggerLabel="Evidence actions" entries={entries()} />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Evidence actions" }));
    const firstItem = screen.getByRole("menuitem", { name: "Alpha source" });
    await waitFor(() => expect(firstItem).toHaveFocus());

    expect(fireEvent.keyDown(firstItem, { key: "Tab" })).toBe(false);
    expect(screen.getByRole("menu")).toBeVisible();
  });

  it("clears typeahead state whenever the menu closes", async () => {
    const user = userEvent.setup();
    render(<Menu triggerLabel="Evidence actions" entries={entries()} />);
    const trigger = screen.getByRole("button", { name: "Evidence actions" });

    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Alpha source" })).toHaveFocus(),
    );
    await user.keyboard("g");
    expect(screen.getByRole("menuitem", { name: "Gamma source" })).toHaveFocus();
    await user.keyboard("{Escape}");

    await user.keyboard("{ArrowUp}");
    await waitFor(() =>
      expect(screen.getByRole("menuitemcheckbox", { name: "Include context" })).toHaveFocus(),
    );
    await user.keyboard("a");
    expect(screen.getByRole("menuitem", { name: "Alpha source" })).toHaveFocus();
  });

  it("clears typeahead state when a controlled owner closes the menu", async () => {
    const user = userEvent.setup();
    const menuEntries = entries();
    const { rerender } = render(
      <Menu triggerLabel="Evidence actions" entries={menuEntries} open />,
    );
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Alpha source" })).toHaveFocus(),
    );
    await user.keyboard("g");
    expect(screen.getByRole("menuitem", { name: "Gamma source" })).toHaveFocus();

    rerender(<Menu triggerLabel="Evidence actions" entries={menuEntries} open={false} />);
    expect(screen.queryByRole("menu")).toBeNull();
    rerender(<Menu triggerLabel="Evidence actions" entries={menuEntries} open />);
    const context = await screen.findByRole("menuitemcheckbox", {
      name: "Include context",
    });
    await user.click(context);
    expect(context).toHaveFocus();
    await user.keyboard("a");
    expect(screen.getByRole("menuitem", { name: "Alpha source" })).toHaveFocus();
  });

  it("closes on an outside primary pointer without stealing the clicked target's focus", async () => {
    const user = userEvent.setup();
    const pointerDefaultPrevented = vi.fn();
    const outsideClick = vi.fn();
    render(
      <>
        <Menu triggerLabel="Evidence actions" entries={entries()} />
        <button
          type="button"
          onClick={outsideClick}
          onPointerDown={(event) => pointerDefaultPrevented(event.defaultPrevented)}
        >
          Outside target
        </button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Evidence actions" }));
    const outside = screen.getByRole("button", { name: "Outside target" });
    await user.click(outside);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(outside).toHaveFocus();
    expect(pointerDefaultPrevented).toHaveBeenCalledWith(false);
    expect(outsideClick).toHaveBeenCalledOnce();
  });

  it("does not consume a native pointer dismissal already claimed by a higher overlay", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menu triggerLabel="Evidence actions" entries={entries()} />
        <button type="button">Outside target</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Evidence actions" }));
    const outside = screen.getByRole("button", { name: "Outside target" });
    const claimedPointerDown = new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
    });
    claimOverlayPointerDismissal(claimedPointerDown);
    fireEvent(outside, claimedPointerDown);
    expect(screen.getByRole("menu")).toBeVisible();

    fireEvent.pointerDown(outside, { button: 0 });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("closes when focus is moved outside programmatically", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menu triggerLabel="Evidence actions" entries={entries()} />
        <button type="button">Programmatic destination</button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Evidence actions" }));
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Alpha source" })).toHaveFocus(),
    );

    screen.getByRole("button", { name: "Programmatic destination" }).focus();

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.getByRole("button", { name: "Programmatic destination" })).toHaveFocus();
  });

  it("fails closed for blank labels or ambiguous entry contracts", () => {
    expect(() => render(<Menu triggerLabel=" " entries={entries()} />)).toThrow(/triggerLabel/u);
    expect(() =>
      render(
        <Menu
          triggerLabel="Actions"
          entries={[
            { id: "same", label: "One", textValue: "One", onSelect: vi.fn() },
            { id: "same", label: "Two", textValue: "Two", onSelect: vi.fn() },
          ]}
        />,
      ),
    ).toThrow(/non-empty and unique/u);
    expect(() => render(<Menu triggerLabel="Actions" entries={[]} />)).toThrow(
      /at least one actionable/u,
    );
    expect(() =>
      render(<Menu triggerLabel="Actions" entries={[{ id: "separator", type: "separator" }]} />),
    ).toThrow(/at least one actionable/u);
    expect(() =>
      render(
        <Menu
          triggerLabel="Actions"
          entries={[
            {
              id: "blank-label",
              label: " ",
              textValue: "Blank label",
              onSelect: vi.fn(),
            },
          ]}
        />,
      ),
    ).toThrow(/labels\/textValue/u);
  });

  it("has no detectable accessibility violations while expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(<Menu triggerLabel="Evidence actions" entries={entries()} />);
    await user.click(screen.getByRole("button", { name: "Evidence actions" }));
    const menu = await screen.findByRole("menu");
    expect((await axe(container)).violations).toHaveLength(0);
    expect((await axe(menu)).violations).toHaveLength(0);
  });
});
