import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthLayout from "./layout";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "auth.brandPanelLabel": "TryVit product identity",
        "auth.brandEyebrow": "Private beta · Source Fold",
        "auth.brandTitle": "Know what the label really says.",
        "auth.marketingBlurb": "Search, scan, and compare food products.",
        "auth.brandRegisterLabel": "TryVit decision path",
        "auth.brandRegisterSearch": "01 Search",
        "auth.brandRegisterDecode": "02 Decode",
        "auth.brandRegisterDecide": "03 Decide",
        "auth.brandFooter": "Food intelligence, with the evidence left visible.",
        "auth.accountAccessLabel": "Account access",
        "auth.privateBetaShort": "Private beta",
      })[key] ?? key,
  }),
}));

describe("AuthLayout", () => {
  it("renders children in the account-access panel", () => {
    render(
      <AuthLayout>
        <div data-testid="child">Form content</div>
      </AuthLayout>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByLabelText("Account access")).toContainElement(
      screen.getByTestId("child"),
    );
  });

  it("uses the Source Fold identity rather than the old onboarding illustration", () => {
    const { container } = render(
      <AuthLayout>
        <div>Form</div>
      </AuthLayout>,
    );
    expect(screen.getByText("Know what the label really says.")).toBeInTheDocument();
    expect(screen.getByText("01 Search")).toBeInTheDocument();
    expect(
      container.querySelector('img[src="/illustrations/onboarding/step-1-welcome.svg"]'),
    ).not.toBeInTheDocument();
  });

  it("keeps a branded mobile entry header", () => {
    render(
      <AuthLayout>
        <div>Form</div>
      </AuthLayout>,
    );
    expect(screen.getAllByRole("img", { name: "TryVit" })).toHaveLength(2);
    expect(document.querySelectorAll('[data-landing-lockup="horizontal"]')).toHaveLength(2);
    expect(screen.getAllByText("Private beta").length).toBeGreaterThanOrEqual(1);
  });
});
