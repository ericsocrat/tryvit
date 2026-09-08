import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { evidenceEnvelope, evidenceProduct } from "@/components/evidence/product-evidence.fixtures";
import { evidenceQueryKeys } from "@/lib/evidence/api";
import ProductLayout, { generateMetadata } from "./layout";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), locale: vi.fn(async () => "en"), setData: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ rpc: mocks.rpc })) }));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: mocks.locale }));
vi.mock("@tanstack/react-query", () => ({
  QueryClient: class { setQueryData = mocks.setData; },
  dehydrate: () => ({}),
  HydrationBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const params = (id = "42") => Promise.resolve({ id });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale.mockResolvedValue("en");
  mocks.rpc.mockResolvedValue({ data: evidenceEnvelope([evidenceProduct(42)]), error: null });
});

describe("validated evidence metadata", () => {
  it("uses the same v2 endpoint and locale as the client", async () => {
    const metadata = await generateMetadata({ params: params() });
    expect(mocks.rpc).toHaveBeenCalledWith("api_product_read_model", { p_product_ids: [42], p_language: "en" });
    expect(metadata.title).toBe("Fixture product 42");
    expect(metadata.description).toContain("evidence availability");
    expect(JSON.stringify(metadata)).not.toMatch(/health score|aggregateRating|nutritionInformation/i);
    expect(metadata.openGraph).toMatchObject({ title: "Fixture product 42", type: "article" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it.each(["0", "42abc", "1.5", "01", "9007199254740992"])("rejects malformed ID %s instead of parseInt coercion", async (id) => {
    expect((await generateMetadata({ params: params(id) })).title).toBe("Product information");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["transport", "contract", "missing"] as const)("publishes a conservative fallback for %s failure", async (failure) => {
    if (failure === "transport") mocks.rpc.mockRejectedValue(new Error("Unavailable"));
    if (failure === "contract") mocks.rpc.mockResolvedValue({ data: { products: [{ product_name: "Unvalidated name" }] }, error: null });
    if (failure === "missing") mocks.rpc.mockResolvedValue({ data: evidenceEnvelope([], [42]), error: null });
    const metadata = await generateMetadata({ params: params() });
    expect(metadata.title).toBe("Product information");
    expect(metadata.description).toBeUndefined();
  });

  it("localizes the metadata description", async () => {
    mocks.locale.mockResolvedValue("pl");
    const metadata = await generateMetadata({ params: params() });
    expect(metadata.description).toContain("wartości odżywcze");
    expect(mocks.rpc).toHaveBeenCalledWith("api_product_read_model", { p_product_ids: [42], p_language: "pl" });
  });
});

describe("evidence hydration and JSON-LD", () => {
  async function layout() {
    return render(await ProductLayout({ children: <p>Product content</p>, params: params() }));
  }

  it("hydrates the validated v2 envelope, not legacy scores or a separate profile key", async () => {
    await layout();
    expect(screen.getByText("Product content")).toBeInTheDocument();
    expect(mocks.setData).toHaveBeenCalledWith(evidenceQueryKeys.products([42], "en"), evidenceEnvelope([evidenceProduct(42)]));
    expect(mocks.setData).toHaveBeenCalledTimes(1);
  });

  it.each([["5901234123457", "gtin13"], ["96385074", "gtin8"], ["036000291452", "gtin12"]])("preserves valid barcode %s in the correct identity field", async (ean, property) => {
    const product = evidenceProduct(42);
    product.ean = ean;
    product.image = { url: "https://images.openfoodfacts.org/images/products/test.jpg", alt: "Fixture", source: "fixture", state: "recorded", observation_id: product.sources[0].observation_id, source_key: product.sources[0].source_key };
    mocks.rpc.mockResolvedValue({ data: evidenceEnvelope([product]), error: null });
    const { container } = await layout();
    const json = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");
    expect(json[property]).toBe(ean);
    expect(json.name).toBe(product.product_name);
    expect(json.url).toBe("https://tryvit.app/app/product/42");
    expect(json.image).toBe(product.image.url);
    expect(json.nutrition).toBeUndefined();
    expect(json.aggregateRating).toBeUndefined();
  });

  it("does not publish an invalid GTIN or invent a brand/image", async () => {
    const product = evidenceProduct(42);
    product.ean = "5901234123458"; product.brand = "";
    mocks.rpc.mockResolvedValue({ data: evidenceEnvelope([product]), error: null });
    const { container } = await layout();
    const json = JSON.parse(container.querySelector("script")?.textContent ?? "{}");
    expect(json.gtin13).toBeUndefined();
    expect(json.brand).toBeUndefined();
    expect(json.image).toBeUndefined();
  });

  it("escapes script terminators in source-provided identity data", async () => {
    const product = evidenceProduct(42);
    product.product_name = '</script><script>alert("fixture")</script>';
    mocks.rpc.mockResolvedValue({ data: evidenceEnvelope([product]), error: null });
    const { container } = await layout();
    expect(container.querySelectorAll("script")).toHaveLength(1);
    const script = container.querySelector("script");
    expect(script?.textContent).not.toContain("</script>");
    expect(JSON.parse(script?.textContent ?? "{}").name).toBe(product.product_name);
  });

  it("does not emit structured claims on a failed read", async () => {
    mocks.rpc.mockRejectedValue(new Error("Unavailable"));
    const { container } = await layout();
    expect(container.querySelector("script")).toBeNull();
    expect(mocks.setData).not.toHaveBeenCalled();
    expect(screen.getByText("Product content")).toBeInTheDocument();
  });
});
