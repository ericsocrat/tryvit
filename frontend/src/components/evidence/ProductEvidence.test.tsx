import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NutrientValue, ProductNutrition, ProductAllergenSummary, ProductClassifications, ProductIdentityImage, ProductIngredientsAndAllergens, ProductPositiveAllergenNotice, ProductSources, safeSourceUrl, sourceAgeDays, sourceDisplayName } from "./ProductEvidence";
import { evidenceProduct, legacyProduct } from "./product-evidence.fixtures";
import { translate } from "@/lib/i18n-core";
import { assertComponentA11y } from "@/utils/test/a11y";

const locale = vi.hoisted(() => ({ language: "en" as "en" | "pl" | "de" }));
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ language: locale.language, t: (key: string, values?: Record<string, string | number>) => translate(locale.language, key, values) }) }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- forwarded test image
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
beforeEach(() => { locale.language = "en"; });
afterEach(() => { vi.restoreAllMocks(); });

describe("recognizable source attribution", () => {
  it("labels the known provider without inventing a name for another source", () => {
    expect(sourceDisplayName("off_api")).toBe("Open Food Facts");
    expect(sourceDisplayName("independent-manual-source")).toBe("independent-manual-source");
  });
  it.each(["en", "pl", "de"] as const)("keeps exact observation links while naming the provider in %s", (language) => {
    locale.language = language;
    const product = evidenceProduct();
    product.sources[0].source_key = "off_api";
    const original = structuredClone(product);
    const { container } = render(<><ProductNutrition product={product} /><ProductSources product={product} /></>);
    expect(screen.getByRole("link", { name: "Open Food Facts" })).toHaveAttribute("href", product.sources[0].source_url);
    expect(container).not.toHaveTextContent("off_api");
    expect(container.querySelector(`a[href="#source-${product.product_id}-${product.sources[0].observation_id}"]`)).toHaveTextContent("Open Food Facts");
    expect(product).toEqual(original);
  });
});

describe("early positive allergen notice", () => {
  it("does not turn missing allergen evidence into a safe-looking notice", () => {
    const product = legacyProduct();
    product.allergens.contains = [];
    product.allergens.traces = [];
    const { container } = render(<ProductPositiveAllergenNotice product={product} />);
    expect(container).toBeEmptyDOMElement();
  });
  it.each(["en", "pl", "de"] as const)("preserves positive and uncertain evidence with a detail link in %s", (language) => {
    locale.language = language;
    const product = evidenceProduct();
    product.allergens.contains = [{ name: "en:gluten", state: "unverified", observation_id: null }];
    product.allergens.traces = [{ name: "en:sesame", state: "recorded", observation_id: product.sources[0].observation_id }];
    product.allergens.state = "conflicting";
    const { container } = render(<ProductPositiveAllergenNotice product={product} />);
    expect(screen.getByRole("link", { name: translate(language, "evidenceUi.allergenNoticeTitle") })).toHaveAttribute("href", `#allergens-${product.product_id}`);
    expect(container).toHaveTextContent(translate(language, "evidenceUi.contains"));
    expect(container).toHaveTextContent(translate(language, "evidenceUi.traces"));
    expect(container).toHaveTextContent(translate(language, "evidenceUi.state.unverified"));
    expect(container).toHaveTextContent(translate(language, "evidenceUi.state.conflicting"));
  });
});

describe("precise and qualified nutrition display", () => {
  it.each([["eq", ""], ["lt", "<"], ["lte", "≤"], ["gt", ">"], ["gte", "≥"], ["approx", "≈"]] as const)("retains qualifier %s and source precision", (qualifier, symbol) => {
    const field = evidenceProduct().nutrition.salt_g;
    const { container } = render(<NutrientValue observation={{ ...field, value: "0.000100000001", qualifier }} />);
    expect(container).toHaveTextContent(`${symbol ? `${symbol} ` : ""}0.000100000001 g`);
    expect(container).toHaveTextContent("Per 100 g · As sold");
  });

  it("shows explicit zero rather than missing evidence", () => {
    const { container } = render(<NutrientValue observation={{ ...evidenceProduct().nutrition.salt_g, value: "0" }} />);
    expect(container).toHaveTextContent("0 g");
    expect(container).not.toHaveTextContent("Not recorded");
  });

  it("announces approximate values explicitly", () => {
    render(<NutrientValue observation={{ ...evidenceProduct().nutrition.salt_g, value: "0.1", qualifier: "approx" }} />);
    expect(screen.getByLabelText("Approximately 0.1 g")).toHaveTextContent("≈ 0.1 g");
  });

  it.each(["missing", "invalid", "conflicting"] as const)("withholds unresolved %s values and preserves the explanation", (state) => {
    const { container } = render(<NutrientValue observation={{ ...evidenceProduct().nutrition.salt_g, state, value: null, observation_id: null }} />);
    expect(container).toHaveTextContent(translate("en", `evidenceUi.state.${state}`));
    expect(container.querySelector("[data-evidence-state]")?.firstElementChild).not.toHaveTextContent("0 g");
  });

  it.each(["pl", "de"] as const)("localizes the decimal separator without rounding in %s", (language) => {
    locale.language = language;
    const { container } = render(<NutrientValue observation={{ ...evidenceProduct().nutrition.salt_g, value: "0.00100" }} />);
    expect(container).toHaveTextContent("0,00100 g");
  });
});

describe("shared nutrition context", () => {
  it("ties one uniform numeric context to the list while keeping every value and unit", () => {
    const product = evidenceProduct();
    const { container } = render(<ProductNutrition product={product} />);
    const context = screen.getByText("For values shown").closest("p");
    expect(container.querySelector("dl")).toHaveAttribute("aria-describedby", context?.id);
    expect(screen.getAllByText(translate("en", "evidenceUi.state.recorded"), { exact: false })).toHaveLength(1);
    expect(container.querySelectorAll('[data-evidence-state="recorded"]')).toHaveLength(9);
    expect(container).toHaveTextContent("0.001 kcal");
    expect(container).toHaveTextContent("0.001 g");
  });

  it.each([
    { basis: "per_100ml" }, { preparation_state: "prepared" },
    { state: "unverified" }, { qualifier: null },
  ] as const)("keeps row context when metadata differs: %j", (change) => {
    const product = evidenceProduct();
    Object.assign(product.nutrition.salt_g, change);
    const { container } = render(<ProductNutrition product={product} />);
    expect(screen.queryByText("For values shown")).not.toBeInTheDocument();
    expect(container.querySelector("dl")).toHaveAttribute("aria-describedby", `nutrition-context-${product.product_id}`);
    expect(screen.getAllByText(translate("en", "evidenceUi.state.recorded"))).toHaveLength("state" in change && change.state === "unverified" ? 8 : 9);
  });

  it("does not call a missing row recorded or replace it with zero", () => {
    const product = evidenceProduct();
    Object.assign(product.nutrition.trans_fat_g, { value: null, state: "missing", observation_id: null, qualifier: null, basis: "unknown" });
    const { container } = render(<ProductNutrition product={product} />);
    expect(screen.getByText("For values shown")).toBeInTheDocument();
    const missing = container.querySelector('[data-evidence-state="missing"]');
    expect(missing).toHaveTextContent(translate("en", "evidenceUi.state.missing"));
    expect(missing).not.toHaveTextContent(translate("en", "evidenceUi.state.recorded"));
    expect(missing).not.toHaveTextContent("0 g");
  });

  it("does not manufacture shared context when every value is missing", () => {
    const product = evidenceProduct();
    Object.values(product.nutrition).forEach((field) => Object.assign(field, { value: null, state: "missing", observation_id: null }));
    render(<ProductNutrition product={product} />);
    expect(screen.queryByText("For values shown")).not.toBeInTheDocument();
    expect(screen.getAllByText(translate("en", "evidenceUi.state.missing"))).toHaveLength(9);
  });

  it("shares unknown-qualifier disclosure only when all shown values agree", () => {
    const product = evidenceProduct(1, { qualifier: null });
    const { rerender } = render(<ProductNutrition product={product} />);
    expect(screen.getByText("For values shown")).toBeInTheDocument();
    expect(screen.getAllByText(translate("en", "evidenceUi.qualifierUnknown"), { exact: false })).toHaveLength(1);
    product.nutrition.salt_g.qualifier = "eq";
    rerender(<ProductNutrition product={product} />);
    expect(screen.queryByText("For values shown")).not.toBeInTheDocument();
    expect(screen.getAllByText(translate("en", "evidenceUi.qualifierUnknown"))).toHaveLength(8);
  });

  it("keeps each explicit qualifier visible under a shared context", () => {
    const product = evidenceProduct();
    product.nutrition.salt_g.qualifier = "lt";
    const { container } = render(<ProductNutrition product={product} />);
    expect(screen.getByText("For values shown")).toBeInTheDocument();
    expect(container).toHaveTextContent("< 0.001 g");
  });

  it("retains full metadata for a standalone value by default", () => {
    const field = evidenceProduct(1, { qualifier: null }).nutrition.salt_g;
    render(<NutrientValue observation={field} />);
    expect(screen.getByText(translate("en", "evidenceUi.state.recorded"))).toBeInTheDocument();
    expect(screen.getByText(translate("en", "evidenceUi.qualifierUnknown"))).toBeInTheDocument();
  });
});

describe("field and assertion source navigation", () => {
  it("uses one scoped link when shown numeric values share an observation", () => {
    const product = evidenceProduct();
    render(<ProductNutrition product={product} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "For values shown: Source: fixture-source" })).toHaveAttribute("href", `#source-${product.product_id}-${product.sources[0].observation_id}`);
  });

  it("links mixed numeric revisions per row even when provider and context match", () => {
    const product = evidenceProduct();
    const oldId = "22222222-2222-4222-8222-222222222222";
    product.sources.push({ ...product.sources[0], observation_id: oldId, retrieved_at: "2020-01-01T00:00:00Z", source_updated_at: null });
    product.nutrition.salt_g.observation_id = oldId;
    render(<ProductNutrition product={product} />);
    expect(screen.getAllByRole("link")).toHaveLength(9);
    expect(screen.getByRole("link", { name: "Salt: Source: fixture-source" })).toHaveAttribute("href", `#source-${product.product_id}-${oldId}`);
    expect(screen.getByRole("link", { name: "Sugars: Source: fixture-source" })).toHaveAttribute("href", `#source-${product.product_id}-${product.sources[0].observation_id}`);
  });

  it("does not guess source links for legacy values or missing rows", () => {
    const product = legacyProduct();
    product.sources = evidenceProduct().sources;
    Object.assign(product.nutrition.trans_fat_g, { state: "missing", value: null });
    render(<ProductNutrition product={product} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links ingredient and allergen badges to their actual older/newer revisions", () => {
    const product = evidenceProduct();
    const oldId = "22222222-2222-4222-8222-222222222222";
    product.sources.push({ ...product.sources[0], observation_id: oldId, retrieved_at: "2020-01-01T00:00:00Z", source_updated_at: null });
    product.ingredients.items = [{ name: "Flour", state: "unverified", observation_id: oldId }];
    product.allergens.contains = [{ name: "en:milk", state: "recorded", observation_id: product.sources[0].observation_id }];
    product.allergens.traces = [{ name: "en:sesame", state: "unverified", observation_id: oldId }];
    render(<ProductIngredientsAndAllergens product={product} />);
    expect(screen.getByRole("link", { name: /^Flour · Unverified/ })).toHaveAttribute("href", `#source-${product.product_id}-${oldId}`);
    expect(screen.getByRole("link", { name: /^Milk · Recorded/ })).toHaveAttribute("href", `#source-${product.product_id}-${product.sources[0].observation_id}`);
    expect(screen.getByRole("link", { name: /^Sesame · Unverified/ })).toHaveAttribute("href", `#source-${product.product_id}-${oldId}`);
  });

  it("never links unresolved assertions or compact cards to absent source panels", () => {
    const product = evidenceProduct();
    product.allergens.contains = [{ name: "en:milk", state: "unverified", observation_id: null }];
    const { rerender } = render(<ProductIngredientsAndAllergens product={product} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    product.allergens.contains[0].observation_id = "22222222-2222-4222-8222-222222222222";
    rerender(<ProductIngredientsAndAllergens product={product} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    product.allergens.contains[0].observation_id = product.sources[0].observation_id;
    rerender(<ProductAllergenSummary product={product} compact />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("allergens and classifications", () => {
  it("keeps positive contains and may-contain evidence visible with unverified status", () => {
    const product = legacyProduct();
    product.allergens = { state: "unverified", contains: [{ name: "en:milk", state: "unverified", observation_id: null }], traces: [{ name: "en:nuts", state: "unverified", observation_id: null }] };
    render(<ProductIngredientsAndAllergens product={product} />);
    expect(screen.getByRole("heading", { name: "Contains evidence" })).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "May-contain evidence" })).toBeInTheDocument();
    expect(screen.getByText("en:nuts")).toBeInTheDocument();
    expect(screen.getAllByText("Not established")).toHaveLength(2);
    expect(screen.getByText(/Missing evidence never establishes allergen absence/)).toBeInTheDocument();
  });

  it("does not convert missing ingredients or allergens to absence or suitability", () => {
    render(<ProductIngredientsAndAllergens product={legacyProduct()} />);
    expect(screen.getByText(/Allergen absence has not been assessed/)).toBeInTheDocument();
    expect(screen.getByText(/Do not infer dietary suitability/)).toBeInTheDocument();
    expect(screen.queryByText("Allergen-free")).not.toBeInTheDocument();
  });

  it("attributes classifications and distinguishes missing version/source", () => {
    const product = evidenceProduct();
    product.classifications.nutri_score = { value: null, source: null, version: null, observation_id: null };
    render(<ProductClassifications product={product} />);
    expect(screen.getByText("Source: Not recorded")).toBeInTheDocument();
    expect(screen.getByText("Version: Unknown")).toBeInTheDocument();
    expect(screen.getByText(/not TryVit verification/)).toBeInTheDocument();
  });
});

describe("sources and image provenance", () => {
  it("links classifications to the exact revision and shows its own dates", () => {
    const product = evidenceProduct();
    const newerId = "22222222-2222-4222-8222-222222222222";
    product.sources.push({ ...product.sources[0], observation_id: newerId, retrieved_at: "2026-09-05T00:00:00Z", source_updated_at: "2026-09-02T00:00:00Z" });
    product.classifications.nutri_score.observation_id = newerId;
    render(<ProductClassifications product={product} />);
    expect(screen.getAllByRole("link", { name: "Source: fixture-source" })[0]).toHaveAttribute("href", `#source-${product.product_id}-${newerId}`);
    expect(screen.getByText(/Sep 2, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Aug 1, 2026/)).toBeInTheDocument();
  });

  it("does not borrow current observation dates for an unverified legacy image", () => {
    const product = evidenceProduct();
    product.image = { url: "https://images.openfoodfacts.org/legacy.jpg", source: "Open Food Facts", alt: "Legacy package", state: "unverified", observation_id: null, source_key: null };
    render(<ProductIdentityImage product={product} />);
    expect(screen.getByText(translate("en", "evidenceUi.state.unverified"))).toBeInTheDocument();
    expect(screen.getByText(translate("en", "evidenceUi.state.unverified")).closest("details")).toBeNull();
    fireEvent.click(screen.getByText("Photo details"));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/Aug 1, 2026|Sep 4, 2026/)).not.toBeInTheDocument();
    expect(screen.getByText(`${translate("en", "evidenceUi.sourceUpdated")}: ${translate("en", "evidenceUi.dateUnavailable")}`)).toBeInTheDocument();
  });

  it("distinguishes retrieval age from the original source-update date", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-05T00:00:00.000Z"));
    render(<ProductSources product={evidenceProduct()} />);
    const summary = screen.getByText("Source observations: 1");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "fixture-source" })).toHaveAttribute("href", "https://example.org/fixture-product");
    expect(screen.getByText("Sep 4, 2026 · 1 day ago")).toBeInTheDocument();
    expect(screen.getByText("Aug 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Fixture only")).toBeInTheDocument();
    expect(screen.getByText(/not when the package was verified/)).toBeInTheDocument();
  });

  it("shows no-source state rather than fabricated age, certainty or attribution", () => {
    render(<ProductSources product={legacyProduct()} />);
    fireEvent.click(screen.getByText("Source observations: 0"));
    expect(screen.getByText(/No traceable source observation/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it.each(["javascript:alert(1)", "data:text/html,test", "http://example.org", "https://user:password@example.org", "not a url"])("rejects unsafe source URL %s", (url) => {
    expect(safeSourceUrl(url)).toBeNull();
  });

  it("does not turn invalid or future source dates into a fresh age", () => {
    const now = Date.parse("2026-09-05T00:00:00Z");
    expect(sourceAgeDays("invalid", now)).toBeNull();
    expect(sourceAgeDays("2027-01-01T00:00:00Z", now)).toBeNull();
    expect(sourceAgeDays("2026-09-04T00:00:00Z", now)).toBe(1);
  });

  it("shows a source image and falls back without requesting another service", () => {
    const product = evidenceProduct();
    product.image = { url: "https://images.openfoodfacts.org/images/products/test.jpg", source: "Open Food Facts", alt: "Fixture package", state: "recorded", source_key: product.sources[0].source_key, observation_id: product.sources[0].observation_id };
    render(<ProductIdentityImage product={product} />);
    const image = screen.getByRole("img", { name: "Fixture package" });
    const disclosure = screen.getByText("Photo details").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    expect(disclosure).toContainElement(screen.getByText("Image source: Open Food Facts"));
    fireEvent.click(screen.getByText("Photo details"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Image source: Open Food Facts" })).toHaveAttribute("href", `#source-${product.product_id}-${product.sources[0].observation_id}`);
    expect(screen.getByText("Image source: Open Food Facts")).toBeInTheDocument();
    fireEvent.error(image);
    expect(screen.getByText("Product photo unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps evidence/source content accessible", async () => {
    await assertComponentA11y(<main><h1>Fixture product</h1><ProductIngredientsAndAllergens product={legacyProduct()} /><ProductSources product={legacyProduct()} /></main>);
  });
});
