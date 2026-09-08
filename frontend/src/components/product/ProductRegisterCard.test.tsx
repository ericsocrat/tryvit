import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductRegisterCard } from "./ProductRegisterCard";

describe("evidence-first product identity cards", () => {
  it.each([0, 4, 10, 100, null, undefined, Number.NaN])("never revives a legacy aggregate %s", (score) => {
    render(<ProductRegisterCard productId={1} href="/app/product/1" name="Milk" score={score} scoreBand="low" />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText(/excellent|perfect|healthier/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("product-register-card")).toHaveAttribute("data-evidence-disposition", "legacy_unverified");
  });
  it("distinguishes unavailable and loading from unverified evidence", () => {
    const { rerender } = render(<ProductRegisterCard productId={1} href="/app/product/1" name="Milk" evidence={{ isLoading: true }} />);
    expect(screen.getByTestId("product-register-card")).toHaveAttribute("data-evidence-disposition", "loading");
    rerender(<ProductRegisterCard productId={1} href="/app/product/1" name="Milk" evidence={{ error: new Error("failed") }} />);
    expect(screen.getByTestId("product-register-card")).toHaveAttribute("data-evidence-disposition", "unavailable");
  });
  it("keeps identity and actions usable without source evidence", () => {
    render(<ProductRegisterCard productId={1} href="/app/product/1" name="Milk" brand="Fixture brand" detail="Saved yesterday" actions={<button type="button">Remove</button>} />);
    expect(screen.getByText("Fixture brand")).toBeInTheDocument();
    expect(screen.getByText("Saved yesterday")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/product/1");
    expect(screen.getByRole("link")).not.toContainElement(screen.getByRole("button", { name: "Remove" }));
  });
  it("does not render unsourced legacy grading or trend slots", () => {
    render(<ProductRegisterCard productId={1} href="/app/product/1" name="Milk" badges={<span>Excellent</span>} meta={<span>Stable score</span>} />);
    expect(screen.queryByText("Excellent")).not.toBeInTheDocument();
    expect(screen.queryByText("Stable score")).not.toBeInTheDocument();
  });
});
