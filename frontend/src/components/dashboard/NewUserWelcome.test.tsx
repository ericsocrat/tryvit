import { render, screen } from "@testing-library/react";
import { translate } from "@/lib/i18n-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewUserWelcome } from "./NewUserWelcome";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => translate("en", key),
  }),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("NewUserWelcome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders welcome title and subtitle", () => {
    render(<NewUserWelcome />);
    expect(screen.getByText("Welcome to TryVit")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Get to know what’s in your food." })).toBeInTheDocument();
  });

  it("renders scan CTA linking to /app/scan", () => {
    render(<NewUserWelcome />);
    const scanLink = screen.getByTestId("new-user-scan-cta");
    expect(scanLink).toHaveAttribute("href", "/app/scan");
    expect(screen.getByText("Scan a product")).toBeInTheDocument();
  });

  it("renders browse CTA linking to /app/categories", () => {
    render(<NewUserWelcome />);
    const browseLink = screen.getByTestId("new-user-browse-cta");
    expect(browseLink).toHaveAttribute("href", "/app/categories");
    expect(screen.getByText("Browse categories")).toBeInTheDocument();
  });

  it("does not prefetch authenticated CTA destinations", () => {
    render(<NewUserWelcome />);

    expect(screen.getByTestId("new-user-scan-cta")).toHaveAttribute("data-prefetch", "false");
    expect(screen.getByTestId("new-user-browse-cta")).toHaveAttribute("data-prefetch", "false");
    expect(screen.getByTestId("new-user-search-cta")).toHaveAttribute("data-prefetch", "false");
    expect(screen.getByTestId("new-user-search-cta")).toHaveAttribute("href", "/app/search");
  });

  it("explains label, evidence and comparison without invented product claims", () => {
    render(<NewUserWelcome />);
    expect(screen.getByRole("heading", { name: "What to look for" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Explore the guides" })).toHaveAttribute("href", "/learn");
  });

  it("names the welcome section with its main heading", () => {
    render(<NewUserWelcome />);
    expect(screen.getByRole("region", { name: "Get to know what’s in your food." })).toBeInTheDocument();
  });

  it("has data-testid on container", () => {
    render(<NewUserWelcome />);
    expect(screen.getByTestId("new-user-welcome")).toBeInTheDocument();
  });
});
