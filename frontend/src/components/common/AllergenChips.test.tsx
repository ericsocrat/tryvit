import type { AllergenWarning } from "@/lib/allergen-matching";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AllergenChips } from "./AllergenChips";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeWarning(
  overrides: Partial<AllergenWarning> = {},
): AllergenWarning {
  return {
    tag: "milk",
    labelKey: "allergens.milk",
    icon: "🥛",
    type: "contains",
    ...overrides,
  };
}

// ─── AllergenChips ──────────────────────────────────────────────────────────

describe("AllergenChips", () => {
  // ── Empty state ───────────────────────────────────────────────────────

  it("returns null when warnings is empty", () => {
    const { container } = render(<AllergenChips warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // ── Single chip rendering ─────────────────────────────────────────────

  it("renders a single allergen chip", () => {
    render(<AllergenChips warnings={[makeWarning()]} />);

    const chip = screen.getByTestId("allergen-chip");
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain("Milk");
    expect(chip.textContent).toContain("🥛");
  });

  it("renders the container as an output element (implicit status role)", () => {
    render(<AllergenChips warnings={[makeWarning()]} />);

    const container = screen.getByTestId("allergen-chips");
    expect(container.tagName.toLowerCase()).toBe("output");
  });

  it("sets aria-label with count", () => {
    render(
      <AllergenChips
        warnings={[
          makeWarning({ tag: "milk" }),
          makeWarning({ tag: "eggs", labelKey: "allergens.eggs", icon: "🥚" }),
        ]}
      />,
    );

    const container = screen.getByTestId("allergen-chips");
    expect(container.getAttribute("aria-label")).toBe("2 allergen warnings");
  });

  it("uses singular aria-label for 1 warning", () => {
    render(<AllergenChips warnings={[makeWarning()]} />);

    const container = screen.getByTestId("allergen-chips");
    expect(container.getAttribute("aria-label")).toBe("1 allergen warning");
  });

  // ── Chip styling by type ──────────────────────────────────────────────

  it("applies red styling for 'contains' type chips", () => {
    render(<AllergenChips warnings={[makeWarning({ type: "contains" })]} />);

    const chip = screen.getByTestId("allergen-chip");
    expect(chip.className).toContain("bg-error-bg");
    expect(chip.className).toContain("text-error-text");
  });

  it("applies amber styling for 'traces' type chips", () => {
    render(<AllergenChips warnings={[makeWarning({ type: "traces" })]} />);

    const chip = screen.getByTestId("allergen-chip");
    expect(chip.className).toContain("bg-warning-bg");
    expect(chip.className).toContain("text-warning-text");
  });

  // ── Tooltip text ──────────────────────────────────────────────────────

  it("shows 'Contains: ...' tooltip for contains type", () => {
    render(<AllergenChips warnings={[makeWarning({ type: "contains" })]} />);

    const chip = screen.getByTestId("allergen-chip");
    expect(chip.getAttribute("title")).toBe("Contains: Milk");
  });

  it("shows 'May contain traces: ...' tooltip for traces type", () => {
    render(<AllergenChips warnings={[makeWarning({ type: "traces" })]} />);

    const chip = screen.getByTestId("allergen-chip");
    expect(chip.getAttribute("title")).toBe("May contain traces: Milk");
  });

  // ── Max visible / overflow ────────────────────────────────────────────

  it("renders up to 3 visible chips without overflow", () => {
    const warnings = [
      makeWarning({ tag: "milk" }),
      makeWarning({ tag: "eggs", labelKey: "allergens.eggs", icon: "🥚" }),
      makeWarning({ tag: "gluten", labelKey: "allergens.gluten", icon: "🌾" }),
    ];
    render(<AllergenChips warnings={warnings} />);

    const chips = screen.getAllByTestId("allergen-chip");
    expect(chips).toHaveLength(3);
    expect(screen.queryByTestId("allergen-overflow")).toBeFalsy();
  });

  it("renders overflow badge when more than 3 warnings", () => {
    const warnings = [
      makeWarning({ tag: "milk" }),
      makeWarning({ tag: "eggs", labelKey: "allergens.eggs", icon: "🥚" }),
      makeWarning({ tag: "gluten", labelKey: "allergens.gluten", icon: "🌾" }),
      makeWarning({ tag: "peanuts", labelKey: "allergens.peanuts", icon: "🥜" }),
    ];
    render(<AllergenChips warnings={warnings} />);

    const chips = screen.getAllByTestId("allergen-chip");
    expect(chips).toHaveLength(3);

    const overflow = screen.getByTestId("allergen-overflow");
    expect(overflow).toBeTruthy();
    expect(overflow.textContent).toBe("+1");
  });

  it("overflow badge shows correct count for many extras", () => {
    const warnings = [
      makeWarning({ tag: "milk" }),
      makeWarning({ tag: "eggs", labelKey: "allergens.eggs" }),
      makeWarning({ tag: "gluten", labelKey: "allergens.gluten" }),
      makeWarning({ tag: "peanuts", labelKey: "allergens.peanuts" }),
      makeWarning({ tag: "fish", labelKey: "allergens.fish" }),
      makeWarning({ tag: "celery", labelKey: "allergens.celery" }),
    ];
    render(<AllergenChips warnings={warnings} />);

    const overflow = screen.getByTestId("allergen-overflow");
    expect(overflow.textContent).toBe("+3");
  });

  it("overflow badge has tooltip listing hidden allergens", () => {
    const warnings = [
      makeWarning({ tag: "milk", labelKey: "allergens.milk" }),
      makeWarning({ tag: "eggs", labelKey: "allergens.eggs" }),
      makeWarning({ tag: "gluten", labelKey: "allergens.gluten" }),
      makeWarning({ tag: "peanuts", labelKey: "allergens.peanuts" }),
    ];
    render(<AllergenChips warnings={warnings} />);

    const overflow = screen.getByTestId("allergen-overflow");
    expect(overflow.getAttribute("title")).toBe("Peanuts");
  });
});
