import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SkipLink } from "./SkipLink";

describe("SkipLink", () => {
  afterEach(() => vi.restoreAllMocks());

  it("links to the canonical localized content target", () => {
    render(<SkipLink />);
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
  });

  it("moves focus to the main content target", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const main = document.createElement("main");
    main.id = "main-content";
    document.body.append(main);
    render(<SkipLink />);

    fireEvent.click(screen.getByRole("link", { name: "Skip to content" }));

    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toHaveFocus();
    main.remove();
  });
});
