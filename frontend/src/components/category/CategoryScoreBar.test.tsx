import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryScoreBar } from "./CategoryScoreBar";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("CategoryScoreBar", () => {
  it("renders aria-label on the consumer-facing TryVit scale (not raw unhealthiness)", () => {
    // Raw unhealthiness min=10, max=40 → TryVit ascending: 100-40=60 to 100-10=90.
    // Asymmetric values prove the conversion (raw would read "10 to 40").
    render(<CategoryScoreBar minScore={10} maxScore={40} avgScore={25} />);

    const bar = screen.getByRole("img");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-label", "Score range 60 to 90");
  });

  it("renders filled segment with correct positioning", () => {
    const { container } = render(
      <CategoryScoreBar minScore={30} maxScore={70} avgScore={50} />,
    );

    const segment = container.querySelector("[role=img] > div");
    expect(segment).toBeInTheDocument();
    expect(segment).toHaveStyle({ left: "30%", width: "40%" });
  });

  it("clamps minimum width to 2%", () => {
    const { container } = render(
      <CategoryScoreBar minScore={50} maxScore={50} avgScore={50} />,
    );

    const segment = container.querySelector("[role=img] > div");
    expect(segment).toHaveStyle({ left: "50%", width: "2%" });
  });

  it("applies green band for low avg score", () => {
    const { container } = render(
      <CategoryScoreBar minScore={5} maxScore={15} avgScore={10} />,
    );

    const segment = container.querySelector("[role=img] > div");
    expect(segment?.className).toContain("bg-score-green");
  });

  it("applies red band for high avg score", () => {
    const { container } = render(
      <CategoryScoreBar minScore={60} maxScore={80} avgScore={70} />,
    );

    const segment = container.querySelector("[role=img] > div");
    expect(segment?.className).toContain("bg-score-red");
  });

  it("applies darkred band for very high avg score", () => {
    const { container } = render(
      <CategoryScoreBar minScore={85} maxScore={99} avgScore={90} />,
    );

    const segment = container.querySelector("[role=img] > div");
    expect(segment?.className).toContain("bg-score-darkred");
  });

  it("renders track with rounded-full", () => {
    const { container } = render(
      <CategoryScoreBar minScore={10} maxScore={90} avgScore={50} />,
    );

    const track = container.querySelector("[role=img]");
    expect(track?.className).toContain("rounded-full");
  });
});
