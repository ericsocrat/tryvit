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
    expect(screen.getByRole("img", { name: "TryVit" })).toBeInTheDocument();
  });

  it("renders children in main area", () => {
    render(
      <OnboardingLayout>
        <p>Step 1 content</p>
      </OnboardingLayout>,
    );
    expect(screen.getByText("Step 1 content")).toBeInTheDocument();
  });

  it("opts the standalone onboarding surface into the V2 design system", () => {
    const { container } = render(
      <OnboardingLayout>
        <span />
      </OnboardingLayout>,
    );
    expect(container.firstElementChild).toHaveAttribute("data-design-system", "v2");
  });
});
