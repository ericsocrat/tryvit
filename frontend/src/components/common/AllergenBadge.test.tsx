import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { name?: string }) =>
      `${key}${params?.name ? ` ${params.name}` : ""}`,
  }),
}));

import { AllergenBadge } from "./AllergenBadge";

describe("AllergenBadge", () => {
  it("renders explicit presence with warning styling", () => {
    render(<AllergenBadge status="present" allergenName="Milk" />);
    const badge = screen.getByLabelText("allergenBadge.present Milk");
    expect(badge.className).toContain("text-allergen-present");
  });

  it("renders may-contain evidence", () => {
    render(<AllergenBadge status="traces" allergenName="Nuts" />);
    expect(
      screen.getByLabelText("allergenBadge.traces Nuts"),
    ).toBeInTheDocument();
  });

  it("renders deterministic derived evidence distinctly", () => {
    render(<AllergenBadge status="derived" allergenName="Gluten" />);
    expect(
      screen.getByLabelText("allergenBadge.derived Gluten"),
    ).toHaveClass("text-warning-text");
  });

  it("renders missing evidence as neutral unknown, never green", () => {
    render(<AllergenBadge status="unknown" allergenName="Soy" />);
    const badge = screen.getByLabelText("allergenBadge.unknown Soy");
    expect(badge).toHaveClass("text-foreground-muted", "bg-surface-muted");
    expect(badge.className).not.toContain("allergen-free");
  });

  it("reserves green treatment for authoritative assessed absence", () => {
    render(<AllergenBadge status="assessed-absent" allergenName="Sesame" />);
    const badge = screen.getByLabelText(
      "allergenBadge.assessedAbsent Sesame",
    );
    expect(badge.className).toContain("text-allergen-free");
  });

  it("applies size classes", () => {
    render(<AllergenBadge status="present" allergenName="Eggs" size="md" />);
    expect(screen.getByLabelText("allergenBadge.present Eggs")).toHaveClass(
      "text-sm",
    );
  });

  it("shows an evidence-specific tooltip", async () => {
    const user = userEvent.setup();
    render(
      <TooltipPrimitive.Provider delayDuration={0}>
        <AllergenBadge status="derived" allergenName="Gluten" showTooltip />
      </TooltipPrimitive.Provider>,
    );
    await user.hover(screen.getByText("Gluten"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Gluten");
  });
});
