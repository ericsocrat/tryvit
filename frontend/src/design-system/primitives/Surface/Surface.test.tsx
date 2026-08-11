import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Surface, type SurfaceProps } from "./Surface";

describe("V2 Surface", () => {
  it("uses semantic attributes without freezing an art direction in the API", () => {
    render(
      <Surface as="article" boundary="strong" density="compact" layer="raised">
        Evidence summary
      </Surface>,
    );
    const surface = screen.getByText("Evidence summary");
    expect(surface.tagName).toBe("ARTICLE");
    expect(surface).toHaveAttribute("data-layer", "raised");
    expect(surface).toHaveAttribute("data-density", "compact");
    expect(surface).toHaveAttribute("data-boundary", "strong");
  });

  it("rejects interactive roots even if an untyped caller bypasses TypeScript", () => {
    const unsafeProps = {
      as: "button",
      children: "Unsafe surface",
    } as unknown as SurfaceProps;

    expect(() => render(<Surface {...unsafeProps} />)).toThrow(
      /Surface must use a noninteractive semantic element/,
    );
  });

  it("rejects interactive behavior on an allowed host after an unsafe cast", () => {
    const unsafeProps = {
      children: "Unsafe surface behavior",
      onClick: () => undefined,
    } as unknown as SurfaceProps;

    expect(() => render(<Surface {...unsafeProps} />)).toThrow(
      /Surface is a noninteractive container and does not accept onClick/,
    );
  });
});
