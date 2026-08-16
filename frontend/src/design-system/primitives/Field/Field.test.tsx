import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

import { Checkbox, Input, Switch, Textarea } from "./Field";

describe("V2 Field family", () => {
  it("merges stable hint, error, external, and textarea-counter IDREFs", () => {
    const { container } = render(
      <>
        <span id="external-description">External context</span>
        <Textarea
          label="Review note"
          hint="Keep it concise"
          error="A note is required"
          aria-describedby="external-description"
          count={{ current: 4, maximum: 80, label: "Characters" }}
        />
      </>,
    );
    const textarea = screen.getByRole("textbox", { name: "Review note" });
    const describedBy = textarea.getAttribute("aria-describedby")?.split(" ") ?? [];

    expect(describedBy).toContain("external-description");
    expect(describedBy).toHaveLength(4);
    for (const referencedId of describedBy) {
      expect(container.ownerDocument.getElementById(referencedId)).not.toBeNull();
    }
    expect(textarea).toHaveAttribute("aria-errormessage");
    expect(screen.getByText("4/80")).toBeVisible();
  });

  it("passes native required and read-only semantics to text controls", () => {
    render(<Input label="Source" required readOnly defaultValue="Package" />);
    const input = screen.getByRole("textbox", { name: "Source" });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("readonly");
  });

  it("synchronizes the checkbox IDL indeterminate state and mixed ARIA state", () => {
    render(<Checkbox label="Some evidence" indeterminate />);
    const checkbox = screen.getByRole("checkbox", { name: "Some evidence" });
    expect(checkbox).toHaveProperty("indeterminate", true);
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
  });

  it("preserves the focused checkbox node when indeterminate state changes", () => {
    const { rerender } = render(<Checkbox indeterminate label="Evidence reviewed" />);
    const checkbox = screen.getByRole("checkbox", { name: "Evidence reviewed" });
    checkbox.focus();

    rerender(<Checkbox indeterminate={false} label="Evidence reviewed" />);
    expect(screen.getByRole("checkbox", { name: "Evidence reviewed" })).toBe(checkbox);
    expect(checkbox).toHaveFocus();
    expect(checkbox).not.toBePartiallyChecked();
  });

  it("lets the native switch handle Space exactly once", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Automatic updates" onChange={onChange} />);
    const control = screen.getByRole("switch", { name: "Automatic updates" });

    control.focus();
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(control).toBeChecked();
  });

  it("fails closed before blank or interactive-looking label copy is rendered", () => {
    expect(() => render(<Input label=" " />)).toThrow(/label must be non-empty/u);
    expect(() => render(<Switch label="Updates" stateLabel=" " />)).toThrow(
      /stateLabel must be non-empty/u,
    );
    expect(() =>
      render(<Textarea label="Review note" count={{ current: 0, maximum: 80, label: " " }} />),
    ).toThrow(/count label must be non-empty/u);
  });

  it("has no detectable accessibility violations in a meaningful field state", async () => {
    const { container } = render(
      <Input
        label="Evidence source"
        hint="Use the package label"
        required
        requiredLabel="Required"
      />,
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
