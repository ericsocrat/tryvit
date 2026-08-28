import type { ProductProvenance } from "@/lib/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductRegisterCard } from "./ProductRegisterCard";

const confirmed: ProductProvenance = {
  api_version: "1",
  product_id: 1,
  product_name: "Milk",
  overall_trust_score: 0.95,
  freshness_status: "fresh",
  source_count: 2,
  data_completeness_pct: 100,
  field_sources: {
    unhealthiness_score: {
      source: "Source",
      last_updated: new Date().toISOString(),
      confidence: 0.9,
    },
  },
  trust_explanation: "Confirmed",
  weakest_area: { field: null, confidence: null },
};

describe("ProductRegisterCard", () => {
  it("uses score-band treatment only for confirmed evidence", () => {
    render(
      <ProductRegisterCard
        productId={1}
        href="/app/product/1"
        name="Milk"
        score={10}
        scoreBand="low"
        evidence={{ data: confirmed }}
      />,
    );

    expect(screen.getByRole("meter", { name: /TryVit Score.*Excellent/i })).toHaveValue(90);
    expect(screen.getByTestId("product-register-card")).toHaveAttribute(
      "data-evidence-disposition",
      "confirmed",
    );
  });

  it("keeps a confirmed zero unhealthiness score as a valid perfect score", () => {
    render(
      <ProductRegisterCard
        productId={1}
        href="/app/product/1"
        name="Milk"
        score={0}
        scoreBand="low"
        evidence={{ data: confirmed }}
      />,
    );

    expect(screen.getByRole("meter", { name: /TryVit Score.*Excellent/i })).toHaveValue(100);
  });

  it("keeps the numeric score visible but provisional when evidence is unavailable", () => {
    render(
      <ProductRegisterCard
        productId={1}
        href="/app/product/1"
        name="Milk"
        score={10}
        scoreBand="low"
        evidence={{ error: new Error("unavailable") }}
      />,
    );

    expect(screen.getByRole("meter", { name: /TryVit Score.*Provisional score/i })).toHaveValue(90);
    expect(screen.getByTestId("product-register-card")).toHaveAttribute(
      "data-evidence-disposition",
      "unavailable",
    );
    expect(screen.queryByText("Excellent")).not.toBeInTheDocument();
  });

  it("keeps actions outside the product link", () => {
    render(
      <ProductRegisterCard
        productId={1}
        href="/app/product/1"
        name="Milk"
        actions={<button type="button">Compare</button>}
      />,
    );
    expect(screen.getByRole("link")).not.toContainElement(
      screen.getByRole("button", { name: "Compare" }),
    );
  });

  it("downgrades mismatched evidence and rejects invalid scores", () => {
    render(
      <ProductRegisterCard
        productId={2}
        href="/app/product/2"
        name="Milk"
        score={-5}
        scoreBand="low"
        evidence={{ data: confirmed }}
      />,
    );

    expect(screen.getByTestId("product-register-card")).toHaveAttribute(
      "data-evidence-disposition",
      "provisional",
    );
    expect(screen.getByRole("status", { name: /TryVit Score.*Provisional/i })).toHaveTextContent(
      "—",
    );
  });
});
