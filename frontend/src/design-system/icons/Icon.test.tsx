import { render, screen } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { Icon } from "./Icon";
import { iconRegistry } from "./registry";

describe("V2 Icon", () => {
  it("marks decorative registry glyphs as hidden", () => {
    const { container } = render(<Icon name="action.search" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("gives informational glyphs an accessible image name", () => {
    render(<Icon label="Connection unavailable" name="feedback.offline" />);
    expect(screen.getByRole("img", { name: "Connection unavailable" })).toBeVisible();
  });

  it("exposes only typed semantic registry keys", () => {
    expect(Object.keys(iconRegistry)).toEqual(
      expect.arrayContaining([
        "action.close",
        "action.copy",
        "action.delete",
        "action.edit",
        "feedback.error",
        "evidence.records",
      ]),
    );
  });

  it("does not allow unsafe SVG props to override the frozen contract", () => {
    const unsafeProps = {
      name: "feedback.error",
      label: "Evidence error",
      "aria-hidden": "true",
      "aria-label": "Unsafe override",
      focusable: "true",
      fill: "red",
      stroke: "red",
      strokeWidth: 8,
      vectorEffect: "none",
    } as unknown as ComponentProps<typeof Icon>;

    render(createElement(Icon, unsafeProps));
    const icon = screen.getByRole("img", { name: "Evidence error" });
    expect(icon).not.toHaveAttribute("aria-hidden");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(icon).toHaveAttribute("fill", "none");
    expect(icon).toHaveAttribute("stroke", "currentColor");
    expect(icon).toHaveAttribute("stroke-width", "2");
    expect(icon).toHaveAttribute("vector-effect", "non-scaling-stroke");
  });

  it("rejects an empty informational name", () => {
    expect(() => render(<Icon label="  " name="feedback.info" />)).toThrow(
      /Icon label must be non-empty/,
    );
  });
});
