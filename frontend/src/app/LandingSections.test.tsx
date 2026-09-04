import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LandingSections } from "./LandingSections";

describe("LandingSections", () => {
  it("remains server-led without auth or browser hooks", () => {
    const source = readFileSync(join(process.cwd(), "src/app/LandingSections.tsx"), "utf8");
    expect(source).not.toMatch(/^\s*["']use client["'];/mu);
    expect(source).not.toContain("@/lib/supabase");
    expect(source).not.toContain("useEffect");
    expect(source).not.toContain("useState");
  });

  it("renders the selected identity and decision-first hero", () => {
    render(<LandingSections language="en" />);
    expect(screen.queryByRole("img", { name: "TryVit" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Read the package. See the reasoning. Make your own call.",
    );
    expect(screen.getByText(/scan a barcode, browse products, and compare label facts/i)).toBeInTheDocument();
    expect(screen.getByText(/where the information comes from and what is still missing/i)).toBeInTheDocument();
  });

  it("renders four accountable evidence layers in order", () => {
    render(<LandingSections language="en" />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Observed facts",
      "Derived interpretation",
      "Applied context",
      "Decision and next action",
    ]);
    expect(screen.getByText(/processing is not assessed/i)).toBeInTheDocument();
  });

  it("retains meaningful package-to-label content before interaction", async () => {
    const user = userEvent.setup();
    const { container } = render(<LandingSections language="en" />);
    const disclosure = container.querySelector("details");
    const summary = disclosure?.querySelector("summary");
    expect(disclosure).not.toHaveAttribute("open");
    expect(summary).not.toBeNull();
    expect(summary?.querySelector("div, section, article, button, a, input")).toBeNull();
    expect(
      [...(summary?.children ?? [])].every((element) => element.tagName === "SPAN"),
    ).toBe(true);
    expect(summary).toHaveTextContent("Synthetic example");
    expect(screen.getByText("Package source")).toBeInTheDocument();
    expect(screen.getAllByText("Decision and next action").length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByText("Unfold the evidence"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("Fold back to source")).toBeInTheDocument();
  });

  it("renders production-safe live actions", () => {
    render(<LandingSections language="en" />);
    expect(screen.getByRole("link", { name: "Beta access" })).toHaveAttribute(
      "href",
      "/auth/signup",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    expect(
      screen.getByText(/checks only whether you already have a TryVit session/iu),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not start the camera or look up product data/iu)).toBeInTheDocument();
  });

  it("renders a truthful demo state without account actions", () => {
    render(<LandingSections dataAvailable={false} language="en" />);
    expect(
      screen.getByRole("heading", {
        name: "The website is available; live product data is paused",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beta access" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/auth/signup")).toBe(false);
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Contact" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/does not check for an account or session/iu)).toBeInTheDocument();
    expect(screen.getByText(/no hosted product service is used as a fallback/iu)).toBeInTheDocument();
  });

  it("uses complete heading and landmark-compatible section structure", () => {
    render(<LandingSections language="en" />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });
});
