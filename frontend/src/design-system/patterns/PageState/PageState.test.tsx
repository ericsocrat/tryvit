import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageState } from "./PageState";

describe("V2 PageState", () => {
  it.each(["loading", "empty", "error", "offline", "degraded", "recovering", "paused"] as const)(
    "renders the %s hierarchy",
    (status) => {
      render(<PageState status={status} title={`${status} title`} />);
      expect(screen.getByRole("heading", { name: `${status} title` })).toBeVisible();
      expect(screen.getByText(`${status} title`).closest("section")).toHaveAttribute(
        "data-page-state",
        status,
      );
    },
  );

  it("marks loading and recovering content busy", () => {
    const { container, rerender } = render(<PageState status="loading" title="Loading" />);
    const loadingStatus = screen.getByRole("status");
    expect(loadingStatus).not.toHaveAttribute("aria-busy");
    expect(loadingStatus.closest("[aria-busy='true']")).toBeNull();
    expect(container.querySelector("[data-ds-part='update-region']")).toHaveAttribute(
      "aria-busy",
      "true",
    );

    rerender(<PageState status="recovering" title="Recovering" />);
    expect(screen.getByRole("status")).toHaveTextContent("Recovering");
    expect(screen.getByRole("status")).not.toHaveAttribute("aria-busy");
    expect(container.querySelector("[data-ds-part='update-region']")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("defaults errors to polite and requires an explicit assertive request", () => {
    const { rerender } = render(<PageState status="error" title="Could not load" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

    rerender(<PageState announce="assertive" status="error" title="Could not load" />);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("allows the containing page to select the correct heading level", () => {
    const { rerender } = render(
      <PageState headingLevel={1} status="empty" title="No reviewed evidence" />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "No reviewed evidence" })).toBeVisible();

    rerender(<PageState headingLevel={6} status="empty" title="Deep section state" />);
    expect(screen.getByRole("heading", { level: 6, name: "Deep section state" })).toBeVisible();
  });

  it("fails closed for blank copy or an unsafe runtime heading level", () => {
    expect(() => render(<PageState status="empty" title=" " />)).toThrow(
      /title must be non-empty/u,
    );
    expect(() => render(<PageState description=" " status="empty" title="No evidence" />)).toThrow(
      /description must be non-empty/u,
    );
    expect(() =>
      render(<PageState headingLevel={7 as unknown as 2} status="empty" title="No evidence" />),
    ).toThrow(/headingLevel must be an integer from 1 through 6/u);
  });

  it("keeps degraded content available with recovery actions", () => {
    render(
      <PageState
        primaryAction={<button type="button">Retry</button>}
        status="degraded"
        title="Showing saved evidence"
      >
        <p>Saved record remains readable.</p>
      </PageState>,
    );
    expect(screen.getByText("Saved record remains readable.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
