import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OnboardingLayout from "./layout";

describe("OnboardingLayout", () => {
  it("renders TryVit logo in header", () => {
    render(
      <OnboardingLayout>
        <p>child</p>
      </OnboardingLayout>,
    );
    expect(screen.getByAltText("TryVit")).toBeInTheDocument();
  });

  it("renders children in main area", () => {
    render(
      <OnboardingLayout>
        <p>Step 1 content</p>
      </OnboardingLayout>,
    );
    expect(screen.getByText("Step 1 content")).toBeInTheDocument();
  });

  it("renders header with border styling", () => {
    render(
      <OnboardingLayout>
        <span />
      </OnboardingLayout>,
    );
    const header = screen.getByAltText("TryVit").closest("header");
    expect(header?.className).toContain("border-b");
  });
});
