import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminLayout from "./layout";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPathname = vi.fn<() => string>().mockReturnValue("/app/admin/submissions");
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("AdminLayout", () => {
  it("renders the Admin title", () => {
    render(<AdminLayout><div>child</div></AdminLayout>);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders three tab links", () => {
    render(<AdminLayout><div>child</div></AdminLayout>);
    expect(screen.getByText("Submissions")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Monitoring")).toBeInTheDocument();
  });

  it("has correct hrefs for tabs", () => {
    render(<AdminLayout><div>child</div></AdminLayout>);
    expect(screen.getByText("Submissions").closest("a")).toHaveAttribute(
      "href",
      "/app/admin/submissions",
    );
    expect(screen.getByText("Metrics").closest("a")).toHaveAttribute(
      "href",
      "/app/admin/metrics",
    );
    expect(screen.getByText("Monitoring").closest("a")).toHaveAttribute(
      "href",
      "/app/admin/monitoring",
    );
  });

  it("marks the active tab with aria-current=page", () => {
    mockPathname.mockReturnValue("/app/admin/submissions");
    render(<AdminLayout><div>child</div></AdminLayout>);
    const submissionsLink = screen.getByText("Submissions").closest("a");
    expect(submissionsLink).toHaveAttribute("aria-current", "page");
  });

  it("does not mark inactive tabs", () => {
    mockPathname.mockReturnValue("/app/admin/submissions");
    render(<AdminLayout><div>child</div></AdminLayout>);
    const metricsLink = screen.getByText("Metrics").closest("a");
    expect(metricsLink).not.toHaveAttribute("aria-current");
    const monitoringLink = screen.getByText("Monitoring").closest("a");
    expect(monitoringLink).not.toHaveAttribute("aria-current");
  });

  it("marks Metrics tab as active on /app/admin/metrics", () => {
    mockPathname.mockReturnValue("/app/admin/metrics");
    render(<AdminLayout><div>child</div></AdminLayout>);
    const metricsLink = screen.getByText("Metrics").closest("a");
    expect(metricsLink).toHaveAttribute("aria-current", "page");
    const submissionsLink = screen.getByText("Submissions").closest("a");
    expect(submissionsLink).not.toHaveAttribute("aria-current");
  });

  it("renders children", () => {
    render(<AdminLayout><div data-testid="child-content">Page content</div></AdminLayout>);
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders the admin tab navigation landmark", () => {
    render(<AdminLayout><div>child</div></AdminLayout>);
    expect(
      screen.getByRole("navigation", { name: "Admin" }),
    ).toBeInTheDocument();
  });
});
