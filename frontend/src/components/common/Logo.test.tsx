import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

// ─── Logo component tests ────────────────────────────────────────────────────

describe("Logo", () => {
  // ─── Default rendering ──────────────────────────────────────────────────────

  it("renders an accessible image with alt text", () => {
    render(<Logo />);
    const img = screen.getByAltText("TryVit");
    expect(img).toBeInTheDocument();
  });

  it("renders both light and dark variants", () => {
    const { container } = render(<Logo />);
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
  });

  it("hides dark variant from assistive technology", () => {
    const { container } = render(<Logo />);
    const images = container.querySelectorAll("img");
    // Second image (dark variant) should be aria-hidden
    expect(images[1]).toHaveAttribute("aria-hidden", "true");
    expect(images[1]).toHaveAttribute("alt", "");
  });

  // ─── Icon variant (default) ─────────────────────────────────────────────────

  it("defaults to icon variant with 32px size", () => {
    render(<Logo />);
    const img = screen.getByAltText("TryVit");
    expect(img).toHaveAttribute("src", "/logo/logomark.svg");
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveAttribute("height", "32");
  });

  it("uses square dimensions for icon variant", () => {
    render(<Logo variant="icon" size={64} />);
    const img = screen.getByAltText("TryVit");
    expect(img).toHaveAttribute("width", "64");
    expect(img).toHaveAttribute("height", "64");
  });

  it("uses dark logomark for icon dark variant", () => {
    const { container } = render(<Logo variant="icon" />);
    const darkImg = container.querySelector(".logo-dark");
    expect(darkImg).toHaveAttribute("src", "/logo/logomark-dark.svg");
  });

  // ─── Lockup variant ─────────────────────────────────────────────────────────

  it("renders lockup with correct aspect ratio", () => {
    render(<Logo variant="lockup" size={24} />);
    const img = screen.getByAltText("TryVit");
    expect(img).toHaveAttribute("src", "/logo/tryvit-logo.svg");
    expect(img).toHaveAttribute("height", "24");
    // Width = 24 * (200/48) ≈ 100
    expect(img).toHaveAttribute("width", "100");
  });

  it("uses white logo for lockup dark variant", () => {
    const { container } = render(<Logo variant="lockup" />);
    const darkImg = container.querySelector(".logo-dark");
    expect(darkImg).toHaveAttribute("src", "/logo/tryvit-logo-white.svg");
  });

  // ─── CSS theme switching classes ────────────────────────────────────────────

  it("applies logo-light class to light variant image", () => {
    const { container } = render(<Logo />);
    const lightImg = container.querySelector(".logo-light");
    expect(lightImg).toBeInTheDocument();
    expect(lightImg).toHaveAttribute("alt", "TryVit");
  });

  it("applies logo-dark class to dark variant image", () => {
    const { container } = render(<Logo />);
    const darkImg = container.querySelector(".logo-dark");
    expect(darkImg).toBeInTheDocument();
    expect(darkImg).toHaveAttribute("aria-hidden", "true");
  });

  // ─── Custom className ──────────────────────────────────────────────────────

  it("applies custom className to wrapper span", () => {
    const { container } = render(<Logo className="mx-auto mb-4" />);
    const wrapper = container.querySelector("span");
    expect(wrapper?.className).toContain("mx-auto mb-4");
  });

  it("renders without className when not provided", () => {
    const { container } = render(<Logo />);
    const wrapper = container.querySelector("span");
    expect(wrapper?.className).toContain("inline-flex");
  });

  // ─── Size prop ──────────────────────────────────────────────────────────────

  it("respects custom size for icon variant", () => {
    render(<Logo variant="icon" size={48} />);
    const img = screen.getByAltText("TryVit");
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
  });

  it("respects custom size for lockup variant", () => {
    render(<Logo variant="lockup" size={28} />);
    const img = screen.getByAltText("TryVit");
    expect(img).toHaveAttribute("height", "28");
    // Width = 28 * (200/48) ≈ 117
    expect(img).toHaveAttribute("width", "117");
  });
});
