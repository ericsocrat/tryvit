import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CachedTimestamp } from "./CachedTimestamp";

vi.mock("@/lib/cache-manager", () => ({
  timeAgo: vi.fn().mockReturnValue("2h ago"),
}));

describe("CachedTimestamp", () => {
  it("renders cached timestamp badge", () => {
    const cachedAt = Date.now() - 2 * 3600_000;
    render(<CachedTimestamp cachedAt={cachedAt} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/2h ago/)).toBeInTheDocument();
  });

  it("has accessible status role", () => {
    render(<CachedTimestamp cachedAt={Date.now()} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has amber styling classes", () => {
    render(<CachedTimestamp cachedAt={Date.now()} />);
    const badge = screen.getByRole("status");
    expect(badge.className).toContain("bg-warning-bg");
    expect(badge.className).toContain("text-warning-text");
  });
});
