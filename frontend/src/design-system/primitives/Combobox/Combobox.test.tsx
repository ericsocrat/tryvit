import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

import { Combobox, type ComboboxOption, type ComboboxProps } from "./Combobox";

const options = [
  { value: "package", label: "Package label" },
  { value: "maker", label: "Manufacturer record" },
  { value: "retailer", label: "Retailer record", disabled: true },
] as const;

function props(overrides: Partial<ComboboxProps> = {}): ComboboxProps {
  return {
    label: "Evidence source",
    options,
    loadingMessage: "Loading sources",
    emptyMessage: "No matching sources",
    resultsMessage: (count) => `${count} sources available`,
    ...overrides,
  };
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

describe("V2 Combobox", () => {
  it("keeps DOM focus on the input while arrows move active descendant and Enter selects", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Combobox {...props({ onValueChange })} />);
    const input = screen.getByRole("combobox", { name: "Evidence source" });

    await user.click(input);
    expect(input).toHaveFocus();
    const firstActiveId = input.getAttribute("aria-activedescendant");
    expect(firstActiveId).toBe(screen.getByRole("option", { name: "Package label" }).id);

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Manufacturer record" }).id,
    );

    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("maker", options[1]);
    expect(input).toHaveValue("Manufacturer record");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape without erasing text and on Tab without trapping focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Combobox {...props()} />
        <button type="button">After field</button>
      </>,
    );
    const input = screen.getByRole("combobox", { name: "Evidence source" });

    await user.click(input);
    await user.type(input, "Pack");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("Pack");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.click(input);
    await user.tab();
    expect(screen.getByRole("button", { name: "After field" })).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("hands a containing modal's forward Tab boundary back without leaving the modal", async () => {
    const user = userEvent.setup();
    const observedDialogTab = vi.fn();
    render(
      <dialog
        aria-label="Evidence dialog"
        onKeyDown={(event) => {
          if (event.key === "Tab") observedDialogTab(event.defaultPrevented);
        }}
        open
      >
        <button type="button">First modal action</button>
        <Combobox {...props()} />
      </dialog>,
    );
    const first = screen.getByRole("button", { name: "First modal action" });
    const input = screen.getByRole("combobox", { name: "Evidence source" });
    markRendered(first, input);

    await user.click(input);
    await screen.findByRole("listbox");
    await user.tab();

    expect(first).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(observedDialogTab).toHaveBeenCalledWith(true);
  });

  it("honors a parent Tab veto and leaves modified Tab shortcuts native", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <dialog
        aria-label="Vetoed evidence dialog"
        onKeyDownCapture={(event) => {
          if (event.key === "Tab") event.preventDefault();
        }}
        open
      >
        <button type="button">First vetoed action</button>
        <Combobox {...props()} />
      </dialog>,
    );
    const first = screen.getByRole("button", { name: "First vetoed action" });
    const vetoedInput = screen.getByRole("combobox", { name: "Evidence source" });
    markRendered(first, vetoedInput);
    await user.click(vetoedInput);
    await screen.findByRole("listbox");

    fireEvent.keyDown(vetoedInput, { key: "Tab" });
    expect(vetoedInput).toHaveAttribute("aria-expanded", "true");
    expect(first).not.toHaveFocus();
    unmount();

    render(<Combobox {...props({ defaultOpen: true })} />);
    const modifiedInput = screen.getByRole("combobox", { name: "Evidence source" });
    fireEvent.keyDown(modifiedInput, { key: "Tab", metaKey: true });
    expect(modifiedInput).toHaveAttribute("aria-expanded", "true");
  });

  it("does not consume Enter without an active option or native text-editing keys", async () => {
    render(<Combobox {...props({ loading: true, defaultOpen: true })} />);
    const input = screen.getByRole("combobox", { name: "Evidence source" });
    await screen.findByText("Loading sources", { selector: "[aria-hidden='true']" });

    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Home" })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "End" })).toBe(true);
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("resets stale active IDs and exposes visible loading, empty, and load-error states", async () => {
    const { rerender } = render(<Combobox {...props({ defaultOpen: true })} />);
    const input = screen.getByRole("combobox", { name: "Evidence source" });
    await screen.findByRole("listbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "Manufacturer record" }).id,
    );

    rerender(<Combobox {...props({ options: [options[0]], defaultOpen: true })} />);
    await waitFor(() => {
      const activeId = input.getAttribute("aria-activedescendant");
      expect(activeId).toBeTruthy();
      expect(document.getElementById(activeId!)).not.toBeNull();
    });

    rerender(<Combobox {...props({ loading: true, defaultOpen: true })} />);
    expect(
      await screen.findByText("Loading sources", { selector: "[aria-hidden='true']" }),
    ).toBeVisible();
    expect(screen.queryByRole("option")).toBeNull();
    expect(input).not.toHaveAttribute("aria-activedescendant");

    rerender(<Combobox {...props({ loadError: "Sources unavailable", defaultOpen: true })} />);
    expect(
      await screen.findByText("Sources unavailable", { selector: "[aria-hidden='true']" }),
    ).toBeVisible();
    expect(screen.queryByRole("option")).toBeNull();

    rerender(<Combobox {...props({ options: [], defaultOpen: true })} />);
    expect(
      await screen.findByText("No matching sources", { selector: "[aria-hidden='true']" }),
    ).toBeVisible();
  });

  it("repositions against a resized visual viewport without closing", async () => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.assign(visualViewport, {
      height: 600,
      offsetLeft: 0,
      offsetTop: 0,
      width: 800,
    });
    vi.stubGlobal("visualViewport", visualViewport);
    const rectangle = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 40,
      left: 20,
      right: 220,
      top: 60,
      width: 200,
      x: 20,
      y: 60,
      toJSON: () => ({}),
    });

    try {
      render(<Combobox {...props({ defaultOpen: true })} />);
      const popup = await screen.findByRole("listbox");
      const popupContainer = popup.parentElement;
      expect(popupContainer).toHaveStyle({ maxHeight: "488px" });

      act(() => {
        Object.assign(visualViewport, { height: 180 });
        visualViewport.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => expect(popupContainer).toHaveStyle({ maxHeight: "68px" }));
      expect(screen.getByRole("listbox")).toBeVisible();
    } finally {
      rectangle.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("clears a committed value when asynchronous options remove it", async () => {
    const onValueChange = vi.fn();
    const { container, rerender } = render(
      <Combobox {...props({ defaultValue: "maker", onValueChange })} name="evidenceSource" />,
    );
    const input = screen.getByRole("combobox", { name: "Evidence source" });
    const formValue = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="evidenceSource"]',
    );
    expect(input).toHaveValue("Manufacturer record");
    expect(formValue).toHaveValue("maker");

    rerender(
      <Combobox {...props({ options: [options[0]], onValueChange })} name="evidenceSource" />,
    );

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith(null, null);
      expect(input).toHaveValue("");
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(formValue).toHaveValue("");
  });

  it("requests one fail-closed clear for an out-of-domain controlled value", async () => {
    const onValueChange = vi.fn();
    const { container, rerender } = render(
      <Combobox {...props({ value: "removed", onValueChange })} name="evidenceSource" />,
    );

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(null, null));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: "Evidence source" })).toHaveValue("");
    expect(container.querySelector('input[type="hidden"][name="evidenceSource"]')).toHaveValue("");

    rerender(<Combobox {...props({ value: "removed", onValueChange })} name="evidenceSource" />);
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
  });

  it("synchronizes uncontrolled display text when a controlled selection changes", async () => {
    const { rerender } = render(<Combobox {...props({ value: "package" })} />);
    const input = screen.getByRole("combobox", { name: "Evidence source" });
    expect(input).toHaveValue("Package label");

    rerender(<Combobox {...props({ value: "maker" })} />);
    await waitFor(() => expect(input).toHaveValue("Manufacturer record"));
  });

  it("clears committed API state with null and serializes null at the form boundary", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <Combobox
        {...props({
          defaultValue: "package",
          name: "evidenceSource",
          onValueChange,
        })}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Evidence source" });
    const formValue = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="evidenceSource"]',
    );
    expect(formValue).toHaveValue("package");

    await user.click(input);
    await user.keyboard("{End}");
    await user.type(input, " draft");
    expect(input).toHaveValue("Package label draft");
    expect(onValueChange).toHaveBeenCalledWith(null, null);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalledWith("", null);
    expect(formValue).toHaveValue("");
  });

  it("treats controlled null as clear and rejects the former empty-string sentinel", () => {
    const { container } = render(
      <Combobox {...props({ value: null, defaultValue: "package" })} name="evidenceSource" />,
    );
    expect(screen.getByRole("combobox", { name: "Evidence source" })).toHaveValue("");
    expect(container.querySelector('input[type="hidden"][name="evidenceSource"]')).toHaveValue("");

    expect(() => render(<Combobox {...props({ value: "" })} />)).toThrow(
      /must use null, not an empty-string sentinel/u,
    );
    expect(() => render(<Combobox {...props({ defaultValue: "" })} />)).toThrow(
      /must use null, not an empty-string sentinel/u,
    );
  });

  it("requires a real selection and disables its submitted form value", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(
      <Combobox
        {...props()}
        name="evidenceSource"
        required
        requiredSelectionMessage="Choose an evidence source"
      />,
    );
    const input = screen.getByRole("combobox", { name: "Evidence source" });
    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toBe("Choose an evidence source");

    await user.click(input);
    await user.keyboard("{Enter}");
    expect(input.checkValidity()).toBe(true);

    rerender(<Combobox {...props({ defaultValue: "package" })} disabled name="evidenceSource" />);
    expect(container.querySelector('input[type="hidden"][name="evidenceSource"]')).toBeDisabled();
  });

  it("fails closed when option values are empty or duplicated", () => {
    expect(() =>
      render(
        <Combobox
          {...props({
            options: [
              { value: "duplicate", label: "First" },
              { value: "duplicate", label: "Second" },
            ],
          })}
        />,
      ),
    ).toThrow(/non-empty and unique/u);
    expect(() =>
      render(<Combobox {...props({ options: [{ value: "blank-label", label: " " }] })} />),
    ).toThrow(/labels\/descriptions must be non-empty/u);
    expect(() => render(<Combobox {...props({ label: " " })} />)).toThrow(
      /label must be non-empty/u,
    );
    expect(() => render(<Combobox {...props()} required requiredSelectionMessage=" " />)).toThrow(
      /requiredSelectionMessage must be non-empty/u,
    );
  });

  it("fails closed before interactive or blank status content can enter the popup", () => {
    const interactiveStatus = (
      <button type="button">Injected status action</button>
    ) as unknown as string;
    expect(() =>
      render(<Combobox {...props({ loadingMessage: interactiveStatus })} loading />),
    ).toThrow(/status messages must be non-empty localized text/u);
    expect(() => render(<Combobox {...props({ emptyMessage: " " })} />)).toThrow(
      /status messages must be non-empty localized text/u,
    );
    expect(screen.queryByRole("button", { name: "Injected status action" })).toBeNull();
  });

  it("fails closed before interactive React content can enter role=option", () => {
    const interactiveDescription = (
      <button type="button">Injected option action</button>
    ) as unknown as string;
    const interactiveOptions: readonly ComboboxOption[] = [
      {
        value: "unsafe",
        label: "Unsafe option",
        description: interactiveDescription,
      },
    ];

    expect(() =>
      render(<Combobox {...props({ options: interactiveOptions, defaultOpen: true })} />),
    ).toThrow(/non-empty localized text; React content is not supported/u);
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.queryByRole("button", { name: "Injected option action" })).toBeNull();
  });

  it("has no detectable accessibility violations while expanded", async () => {
    const { container } = render(<Combobox {...props({ defaultOpen: true })} />);
    const listbox = await screen.findByRole("listbox");
    expect((await axe(container)).violations).toHaveLength(0);
    expect((await axe(listbox)).violations).toHaveLength(0);
  });
});
