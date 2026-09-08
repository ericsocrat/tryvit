import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n-core";
import { DashboardGuide, DashboardHeader, DashboardStart } from "./DashboardWorkspace";

const locale = vi.hoisted(() => ({ value: "en" as "en" | "pl" | "de" }));
vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => translate(locale.value, key, params), language: locale.value }) }));
vi.mock("next/link", () => ({ default: ({ children, href, prefetch, ...props }: React.PropsWithChildren<{ href: string; prefetch?: boolean }>) => <a href={href} data-prefetch={String(prefetch)} {...props}>{children}</a> }));

afterEach(() => { cleanup(); locale.value = "en"; });

describe("DashboardWorkspace", () => {
  it.each(["en", "pl", "de"] as const)("offers translated real actions without destination prefetch in %s", (language) => {
    locale.value = language;
    render(<><DashboardHeader /><DashboardStart /><DashboardGuide /></>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(translate(language, "dashboard.home.welcome"));
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/app/search");
    expect(form).toHaveAttribute("method", "get");
    const input = screen.getByRole("searchbox", { name: translate(language, "dashboard.home.searchPrompt") });
    expect(input).toHaveAttribute("name", "q");
    expect(input).toBeRequired();
    expect(screen.getByRole("button", { name: translate(language, "common.search") })).toHaveAttribute("type", "submit");
    expect(screen.getByTestId("dashboard-scan-cta")).toHaveAttribute("href", "/app/scan");
    expect(screen.getByTestId("dashboard-browse-cta")).toHaveAttribute("href", "/app/categories");
    expect(screen.getByRole("link", { name: translate(language, "dashboard.home.preferences") })).toHaveAttribute("href", "/app/settings");
    for (const link of screen.getAllByRole("link")) expect(link).toHaveAttribute("data-prefetch", "false");
    expect(document.body).not.toHaveTextContent("dashboard.home.");
  });

  it("renders a provided display name as text and retains the product task", () => {
    render(<DashboardHeader displayName="<script>name</script>" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("<script>name</script>");
    expect(document.querySelector("script")).toBeNull();
  });

  it("links to evidence guidance instead of promoting a legacy aggregate", () => {
    render(<DashboardGuide />);
    expect(screen.getByRole("link", { name: translate("en", "dashboard.home.evidenceGuide") })).toHaveAttribute("href", "/learn/confidence");
    expect(document.querySelector('a[href="/learn/tryvit-score"]')).toBeNull();
  });
});
