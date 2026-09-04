import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LandingLiveAuthAction } from "./LandingLiveAuthAction.client";

const { mockUseLivePublicAuth } = vi.hoisted(() => ({
  mockUseLivePublicAuth: vi.fn(),
}));

vi.mock("@/components/layout/LivePublicAuthActions", () => ({
  useLivePublicAuth: mockUseLivePublicAuth,
}));

beforeEach(() => mockUseLivePublicAuth.mockReset());

describe("LandingLiveAuthAction", () => {
  it("renders the signed-out destination while no live user is present", () => {
    mockUseLivePublicAuth.mockReturnValue(false);

    render(
      <LandingLiveAuthAction
        className="action"
        dashboardLabel="Dashboard"
        signedOutHref="/auth/signup"
        signedOutLabel="Beta access"
      />,
    );

    expect(screen.getByRole("link", { name: "Beta access" })).toHaveAttribute(
      "href",
      "/auth/signup",
    );
  });

  it("replaces the signed-out action with Dashboard for a live user", () => {
    mockUseLivePublicAuth.mockReturnValue(true);

    render(
      <LandingLiveAuthAction
        className="action"
        dashboardLabel="Dashboard"
        signedOutHref="/auth/login"
        signedOutLabel="Sign in"
      />,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/app");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
