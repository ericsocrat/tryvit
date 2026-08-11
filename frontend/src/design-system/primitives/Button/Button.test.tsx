import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, type ButtonProps } from "./Button";

describe("V2 Button", () => {
  it("defaults to a non-submitting native button", () => {
    render(<Button>Review evidence</Button>);
    expect(screen.getByRole("button", { name: "Review evidence" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("uses the localized loading label and blocks activation", () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Saving evidence" onClick={onClick}>
        Save evidence
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving evidence" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders only registry-backed decorative icons", () => {
    const { container } = render(
      <Button endIcon="action.continue" startIcon="evidence.records">
        Continue
      </Button>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(container.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(2);
  });

  it("rejects an empty pending action name", () => {
    expect(() =>
      render(
        <Button loading loadingLabel=" ">
          Save evidence
        </Button>,
      ),
    ).toThrow(/loadingLabel must be non-empty/);
  });

  it("fails closed instead of rendering a nameless action", () => {
    expect(() => render(<Button>{" "}</Button>)).toThrow(
      /children must be non-empty localized text/u,
    );
    const unsafeProps = { children: null } as unknown as ButtonProps;
    expect(() => render(<Button {...unsafeProps} />)).toThrow(
      /children must be non-empty localized text/u,
    );
  });

  it("cannot let unsafe ARIA overrides replace the localized pending name", () => {
    const unsafeProps = {
      "aria-label": "Save evidence",
      "aria-labelledby": "stale-button-name",
      children: "Save evidence",
      loading: true,
      loadingLabel: "Saving evidence",
    } as unknown as ButtonProps;

    render(
      <>
        <span id="stale-button-name">Stale action</span>
        <Button {...unsafeProps} />
      </>,
    );
    expect(
      screen.getByRole("button", { name: "Saving evidence" }),
    ).toBeDisabled();
  });
});
