import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoldedTryVitIdentity } from "./FoldedTryVitIdentity";

describe("FoldedTryVitIdentity", () => {
  it("renders the approved horizontal identity with one accessible name", () => {
    const { container } = render(<FoldedTryVitIdentity />);

    expect(screen.getByRole("img", { name: "TryVit" })).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(container.firstElementChild).toHaveAttribute(
      "data-tryvit-folded-lockup",
      "horizontal",
    );
  });

  it("renders only the decorative mark in compact mode", () => {
    const { container } = render(<FoldedTryVitIdentity compact size={24} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.firstElementChild).toHaveAttribute(
      "data-tryvit-folded-lockup",
      "compact",
    );
  });
});
