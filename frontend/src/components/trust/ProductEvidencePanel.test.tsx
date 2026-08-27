import type { ProductProvenance } from "@/lib/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ProductEvidencePanel,
  toSourceFields,
} from "./ProductEvidencePanel";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function provenance(
  overrides: Partial<ProductProvenance> = {},
): ProductProvenance {
  return {
    api_version: "2026-02-27",
    product_id: 42,
    product_name: "Test Product",
    overall_trust_score: 0.9,
    freshness_status: "fresh",
    source_count: 2,
    data_completeness_pct: 100,
    field_sources: {
      saturated_fat_g: {
        source: "Open Food Facts",
        last_updated: new Date().toISOString(),
        confidence: 0.9,
      },
    },
    trust_explanation: "Current evidence",
    weakest_area: { field: "saturated_fat_g", confidence: 0.9 },
    ...overrides,
  };
}

describe("ProductEvidencePanel", () => {
  it("announces loading separately", () => {
    render(
      <ProductEvidencePanel
        provenance={undefined}
        isLoading
        error={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByTestId("product-evidence-loading")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("fails closed and offers retry when provenance is unavailable", () => {
    const onRetry = vi.fn();
    render(
      <ProductEvidencePanel
        provenance={undefined}
        isLoading={false}
        error={new Error("offline")}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "trust.evidence.unavailableDescription",
    );
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("distinguishes uncollected provenance from an error", () => {
    render(
      <ProductEvidencePanel
        provenance={provenance({
          overall_trust_score: 0,
          source_count: 0,
          data_completeness_pct: 0,
          field_sources: {},
        })}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByTestId("product-evidence-panel")).toHaveTextContent(
      "trust.evidence.notCollectedTitle",
    );
    expect(screen.getByTestId("product-evidence-panel")).toHaveTextContent(
      "trust.evidence.freshness.unavailable",
    );
    expect(screen.getAllByText("trust.evidence.notCollectedValue")).toHaveLength(
      2,
    );
    expect(screen.queryByText("trust.badge.low")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps stale evidence visibly provisional", () => {
    render(
      <ProductEvidencePanel
        provenance={provenance({
          freshness_status: "stale",
          data_completeness_pct: 80,
        })}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        compact
      />,
    );

    const panel = screen.getByTestId("product-evidence-panel");
    expect(panel).toHaveTextContent("trust.evidence.provisionalTitle");
    expect(panel).toHaveTextContent("trust.evidence.freshness.stale");
    expect(panel).toHaveTextContent("80%");
  });

  it("does not fabricate an update age for an invalid source date", () => {
    const sources = toSourceFields(
      provenance({
        field_sources: {
          salt_g: {
            source: "Manual entry",
            last_updated: "not-a-date",
            confidence: 0.7,
          },
        },
      }),
    );
    expect(sources).toEqual([
      {
        field: "Salt G",
        source: "Manual entry",
        daysSinceUpdate: null,
      },
    ]);
  });

  it("does not present a future source date as current", () => {
    const sources = toSourceFields(
      provenance({
        field_sources: {
          salt_g: {
            source: "Manual entry",
            last_updated: "2999-01-01T00:00:00Z",
            confidence: 0.7,
          },
        },
      }),
    );
    expect(sources[0]?.daysSinceUpdate).toBeNull();
  });
});
