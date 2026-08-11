import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IconButton, type IconButtonProps } from "./IconButton";

describe("V2 IconButton", () => {
  it("requires and renders its accessible action label", () => {
    render(<IconButton icon="action.settings" label="Evidence settings" />);
    expect(
      screen.getByRole("button", { name: "Evidence settings" }),
    ).toHaveAttribute("type", "button");
  });

  it("announces the pending action state", () => {
    render(
      <IconButton
        icon="action.confirm"
        label="Save"
        loading
        loadingLabel="Saving"
      />,
    );
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
  });

  it("rejects empty accessible and pending names", () => {
    expect(() =>
      render(<IconButton icon="action.settings" label=" " />),
    ).toThrow(/label must be non-empty/);
    expect(() =>
      render(
        <IconButton
          icon="action.confirm"
          label="Save"
          loading
          loadingLabel=" "
        />,
      ),
    ).toThrow(/loadingLabel must be non-empty/);
  });

  it("cannot let unsafe ARIA overrides replace its canonical name", () => {
    const unsafeProps = {
      "aria-label": "Unsafe override",
      "aria-labelledby": "stale-icon-name",
      icon: "action.confirm",
      label: "Save evidence",
    } as unknown as IconButtonProps;

    render(
      <>
        <span id="stale-icon-name">Stale icon action</span>
        <IconButton {...unsafeProps} />
      </>,
    );
    expect(
      screen.getByRole("button", { name: "Save evidence" }),
    ).toBeInTheDocument();
  });
});
