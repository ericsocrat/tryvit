import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

import { Tabs, type TabItem } from "./Tabs";

const items: TabItem[] = [
  { value: "summary", label: "Summary", panel: "Summary panel" },
  { value: "disabled", label: "Unavailable", panel: "Unavailable panel", disabled: true },
  { value: "sources", label: "Sources", panel: "Sources panel" },
  { value: "history", label: "History", panel: "History panel" },
];

describe("V2 Tabs", () => {
  it("uses reciprocal IDs, skips disabled tabs, wraps, and activates automatically", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Evidence sections" items={items} />);
    const summary = screen.getByRole("tab", { name: "Summary" });
    const sources = screen.getByRole("tab", { name: "Sources" });
    const history = screen.getByRole("tab", { name: "History" });

    expect(summary).toHaveAttribute("aria-controls");
    expect(document.getElementById(summary.getAttribute("aria-controls")!)).toHaveAttribute(
      "aria-labelledby",
      summary.id,
    );
    summary.focus();
    await user.keyboard("{ArrowRight}");
    expect(sources).toHaveFocus();
    expect(sources).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Sources panel");

    await user.keyboard("{End}");
    expect(history).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(summary).toHaveFocus();
    expect(summary).toHaveAttribute("aria-selected", "true");
  });

  it("keeps focus and selection separate in manual activation mode", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Tabs
        label="Evidence sections"
        items={items}
        activationMode="manual"
        onValueChange={onValueChange}
      />,
    );
    const summary = screen.getByRole("tab", { name: "Summary" });
    const sources = screen.getByRole("tab", { name: "Sources" });
    summary.focus();

    await user.keyboard("{ArrowRight}");
    expect(sources).toHaveFocus();
    expect(summary).toHaveAttribute("aria-selected", "true");
    expect(sources).toHaveAttribute("aria-selected", "false");
    expect(onValueChange).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(sources).toHaveAttribute("aria-selected", "true");
    expect(onValueChange).toHaveBeenCalledWith("sources");
  });

  it("uses only the vertical axis for vertical tabs", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Evidence sections" items={items} orientation="vertical" />);
    const summary = screen.getByRole("tab", { name: "Summary" });
    const sources = screen.getByRole("tab", { name: "Sources" });
    summary.focus();

    expect(fireEvent.keyDown(summary, { key: "ArrowRight" })).toBe(true);
    expect(summary).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(sources).toHaveFocus();
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");
  });

  it("reverses horizontal arrow movement in RTL", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <Tabs label="Evidence sections" items={items} />
      </div>,
    );
    const summary = screen.getByRole("tab", { name: "Summary" });
    const history = screen.getByRole("tab", { name: "History" });
    summary.focus();

    await user.keyboard("{ArrowRight}");
    expect(history).toHaveFocus();
    expect(history).toHaveAttribute("aria-selected", "true");
  });

  it("honors the nearest LTR override inside an outer RTL scope", async () => {
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <div dir="ltr">
          <Tabs label="Evidence sections" items={items} />
        </div>
      </div>,
    );
    const summary = screen.getByRole("tab", { name: "Summary" });
    const sources = screen.getByRole("tab", { name: "Sources" });
    summary.focus();

    await user.keyboard("{ArrowRight}");
    expect(sources).toHaveFocus();
  });

  it("synchronizes the roving tab stop when a controlled value changes externally", async () => {
    const { rerender } = render(<Tabs label="Evidence sections" items={items} value="summary" />);
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("tabindex", "0");

    rerender(<Tabs label="Evidence sections" items={items} value="sources" />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Sources" })).toHaveAttribute("tabindex", "0");
      expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("tabindex", "-1");
    });
  });

  it("fails closed for unnamed tablists and ambiguous item values", () => {
    expect(() => render(<Tabs label=" " items={items} />)).toThrow(/label/u);
    expect(() =>
      render(
        <Tabs
          label="Evidence sections"
          items={[
            { value: "same", label: "One", panel: "One panel" },
            { value: "same", label: "Two", panel: "Two panel" },
          ]}
        />,
      ),
    ).toThrow(/non-empty and unique/u);
    expect(() =>
      render(
        <Tabs
          label="Evidence sections"
          items={[{ value: "blank", label: " ", panel: "Blank panel" }]}
        />,
      ),
    ).toThrow(/non-empty labels/u);
    expect(() =>
      render(
        <Tabs
          label="Evidence sections"
          items={[
            { value: "one", label: "One", panel: "One panel", disabled: true },
            { value: "two", label: "Two", panel: "Two panel", disabled: true },
          ]}
        />,
      ),
    ).toThrow(/at least one enabled item/u);
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<Tabs label="Evidence sections" items={items} />);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
