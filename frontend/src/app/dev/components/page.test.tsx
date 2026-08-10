import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn();

vi.mock("next/navigation", () => ({ notFound: () => mockNotFound() }));
vi.mock("@/lib/server-locale", () => ({ getServerLocale: vi.fn(async () => "en") }));

describe("DevComponentsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the catalog shell in a non-production environment", async () => {
    const { default: DevComponentsPage } = await import("./page");
    render(await DevComponentsPage());
    expect(
      screen.getByRole("heading", { name: "Design-system foundation catalog" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("living-label-v2-foundation")).toBeInTheDocument();
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
