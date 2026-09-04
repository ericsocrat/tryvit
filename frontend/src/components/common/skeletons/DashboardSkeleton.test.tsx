import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSkeleton } from "./DashboardSkeleton";

describe("DashboardSkeleton", () => {
  it("announces a busy dashboard without exposing placeholder content", () => {
    render(<DashboardSkeleton />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading your dashboard");
    expect(screen.getByTestId("dashboard-loading")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
