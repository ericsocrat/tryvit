import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n-core";
import IngredientProfilePage from "./page";
const getIngredientProfile = vi.fn();
vi.mock("@/lib/api", () => ({ getIngredientProfile }));
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (key: string) => translate("en", key) }) }));
describe("retired ingredient risk profiles", () => {
  it("keeps a useful bookmark destination without republishing legacy certainty", () => {
    render(<IngredientProfilePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ingredient information has changed");
    expect(screen.getByText(/risk profiles are retired/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Read the ingredient guide" })).toHaveAttribute("href", "/learn/additives");
    expect(getIngredientProfile).not.toHaveBeenCalled();
    expect(screen.queryByTestId("concern-badge")).not.toBeInTheDocument();
  });
});
