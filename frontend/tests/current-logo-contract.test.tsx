import { render, screen } from "@testing-library/react";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { LandingLockup } from "@/app/_landing-v2/LandingIdentity";
import { AuthCurrentLogo } from "@/components/auth/AuthCurrentLogo";
import { FoldedTryVitIdentity } from "@/components/common/FoldedTryVitIdentity";

// Existing approved paths, captured before the display-only correction.
const APPROVED_PATH_HASHES = [
  "457e1d57bd56657f88bb1df3caf4bd7853153ef698d884871fb1a4a3c10bd0c5",
  "e5fca6d40eb0b81c9b3b629ef2347f3de6f7bb68d9d7aa16bcf0b309b796e679",
  "ce34cce24fb857cef10a07e1a3ba05609955e95c6994d8bb9ef1524183b6bcda",
];

describe.each([
  ["landing", LandingLockup],
  ["auth", AuthCurrentLogo],
  ["application", FoldedTryVitIdentity],
] as const)("current %s logo", (_surface, Logo) => {
  it("preserves the exact approved mark and lettering paths", () => {
    const { container } = render(<Logo />);
    const hashes = [...container.querySelectorAll("path")].map((path) =>
      createHash("sha256").update(path.getAttribute("d") ?? "").digest("hex"),
    );
    expect(hashes).toEqual(APPROVED_PATH_HASHES);
  });

  it("leaves two units of clearance around the full vertical glyph bounds", () => {
    render(<Logo />);
    const wordmark = screen.getByRole("img", { name: "TryVit" });
    // Browser-measured path bounds are y=2..26; the old 24-unit viewport clipped y.
    expect(wordmark).toHaveAttribute("viewBox", "0 0 96 28");
    expect(wordmark).toHaveAttribute("width", "96");
    expect(wordmark).toHaveAttribute("height", "28");
    expect(screen.getAllByRole("img", { name: "TryVit" })).toHaveLength(1);
  });
});
