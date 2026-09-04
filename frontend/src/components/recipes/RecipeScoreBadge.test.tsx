import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { RecipeScoreBadge } from "./RecipeScoreBadge";
import type { RecipeScore } from "@/lib/types";
import { useLanguageStore } from "@/stores/language-store";

const baseScore: RecipeScore = {
  api_version: "v1",
  recipe_slug: "overnight-oats",
  aggregate_score: 25,
  score_band: "yellow",
  nutrition_summary: {
    avg_calories: 150.5,
    avg_total_fat_g: 6.2,
    avg_saturated_fat_g: 2.1,
    avg_sugars_g: 8.5,
    avg_salt_g: 0.3,
    avg_protein_g: 5,
    avg_fibre_g: 3.2,
  },
  coverage_pct: 75,
  confidence: "medium",
  ingredient_count: 4,
  linked_count: 3,
  note: "Score is the average unhealthiness of linked products (per 100g).",
};

afterEach(() => useLanguageStore.setState({ language: "en" }));

describe("RecipeScoreBadge", () => {
  it.each([null, undefined])("renders nothing when score is %s", (score) => {
    const { container } = render(<RecipeScoreBadge score={score} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not treat an error envelope as score evidence", () => {
    const error = { error: "Recipe not found" } as unknown as RecipeScore;
    const { container } = render(<RecipeScoreBadge score={error} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains unavailable averages when no products are linked", () => {
    render(<RecipeScoreBadge score={{ ...baseScore, linked_count: 0, aggregate_score: 0 }} />);
    expect(screen.getByTestId("recipe-score-empty")).toHaveTextContent("No linked products yet.");
    expect(screen.queryByLabelText(/TryVit Score:/)).not.toBeInTheDocument();
  });

  it.each([
    [25, 75],
    [12, 88],
    [100, 0],
  ])("converts raw unhealthiness %s into TryVit Score %s", (raw, expected) => {
    render(<RecipeScoreBadge score={{ ...baseScore, aggregate_score: raw }} />);
    expect(screen.getByRole("img", {
      name: `Linked-product TryVit Score: ${expected} out of 100; higher is better`,
    })).toHaveTextContent(`${expected}/100`);
    expect(screen.getByText("Higher scores indicate a more favorable nutrition profile.")).toBeInTheDocument();
  });

  it.each([0, -1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    "withholds the score for missing or invalid raw value %s",
    (aggregate_score) => {
      render(<RecipeScoreBadge score={{ ...baseScore, aggregate_score }} />);
      expect(screen.getByText("A usable product score is not available.")).toBeInTheDocument();
      expect(screen.queryByLabelText(/TryVit Score:/)).not.toBeInTheDocument();
    },
  );

  it("labels link coverage without claiming evidence confidence", () => {
    render(<RecipeScoreBadge score={{ ...baseScore, confidence: "high" }} />);
    expect(screen.getByText("Products linked for 3 of 4 ingredients")).toBeInTheDocument();
    expect(screen.queryByText(/high confidence/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Ingredient links do not verify evidence quality or freshness/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Ingredients with linked products" });
    expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(bar).toHaveAttribute("aria-valuetext", "75% of ingredients have linked products");
  });

  it("does not invent coverage for an unavailable percentage", () => {
    render(<RecipeScoreBadge score={{ ...baseScore, coverage_pct: Number.NaN }} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Products linked for 3 of 4 ingredients")).toBeInTheDocument();
  });

  it("hides the optional nutrition section by default", () => {
    render(<RecipeScoreBadge score={baseScore} />);
    expect(screen.queryByTestId("recipe-score-nutrition")).not.toBeInTheDocument();
  });

  it("describes per-100g product averages instead of suggesting daily or serving intake", () => {
    render(<RecipeScoreBadge score={baseScore} showNutrition />);
    expect(screen.getByText("Linked-product averages · per 100 g")).toBeInTheDocument();
    expect(screen.getByText(/Recipe quantities and serving sizes are not included/)).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    const energy = screen.getByTestId("recipe-nutrient-calories");
    expect(within(energy).getByRole("term")).toHaveTextContent("Energy");
    expect(within(energy).getByRole("definition")).toHaveTextContent("150.5 kcal");
    expect(screen.queryByText(/daily/i)).not.toBeInTheDocument();
  });

  it("retains confirmed zero and explicitly labels missing or invalid nutrients", () => {
    render(<RecipeScoreBadge score={{
      ...baseScore,
      nutrition_summary: {
        ...baseScore.nutrition_summary,
        avg_calories: null,
        avg_protein_g: 0,
        avg_salt_g: Number.NaN,
        avg_fibre_g: -1,
      },
    }} showNutrition />);
    expect(screen.getByTestId("recipe-nutrient-calories")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("recipe-nutrient-salt")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("recipe-nutrient-fibre")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("recipe-nutrient-protein")).toHaveTextContent("0 g");
  });

  it.each([
    ["pl", "Średnie powiązanych produktów · na 100 g", "Energia"],
    ["de", "Durchschnitt verknüpfter Produkte · je 100 g", "Energie"],
  ] as const)("localizes product evidence and decimal values in %s", (language, title, energy) => {
    useLanguageStore.setState({ language });
    render(<RecipeScoreBadge score={baseScore} showNutrition />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByTestId("recipe-nutrient-calories")).toHaveTextContent(energy);
    expect(screen.getByTestId("recipe-nutrient-calories")).toHaveTextContent("150,5 kcal");
    expect(screen.queryByText(/Higher scores|ingredients have|High confidence/)).not.toBeInTheDocument();
  });

  it("keeps the score, coverage, and nutrient facts accessible", async () => {
    const { container } = render(<RecipeScoreBadge score={baseScore} showNutrition />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("applies caller spacing", () => {
    render(<RecipeScoreBadge score={baseScore} className="mt-4" />);
    expect(screen.getByTestId("recipe-score-badge")).toHaveClass("mt-4");
  });
});
