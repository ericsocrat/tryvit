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
    expect(screen.getByRole("img", { name: "TryVit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Read the package. See the reasoning. Make your own call.",
    );
    expect(screen.getByText(/confidence and missing evidence stay visible/i)).toBeInTheDocument();
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
    render(<LandingSections language="en" />);
    const button = screen.getByRole("button", { name: "Unfold the evidence" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Package source")).toBeInTheDocument();
    expect(screen.getAllByText("Decision and next action").length).toBeGreaterThanOrEqual(2);

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveTextContent("Fold back to source");
  });

  it("renders production-safe live actions", () => {
    render(<LandingSections language="en" />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/auth/signup",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });

  it("renders a truthful demo state without account actions", () => {
    render(<LandingSections dataAvailable={false} language="en" />);
    expect(
      screen.getByRole("heading", {
        name: "The website is available; live product data is paused",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create an account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Contact" }).length).toBeGreaterThan(0);
  });

  it("uses complete heading and landmark-compatible section structure", () => {
    render(<LandingSections language="en" />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });
});
