import {
    computeEanCheckDigit,
    appendAuthRedirect,
    formatSlug,
    isValidEan,
    isValidEanChecksum,
    sanitizeAuthRedirect,
    sanitizeRedirect,
    stripNonDigits,
} from "@/lib/validation";
import { describe, expect, it } from "vitest";

// ─── sanitizeRedirect ───────────────────────────────────────────────────────

describe("sanitizeRedirect", () => {
  it("allows a simple relative path", () => {
    expect(sanitizeRedirect("/app/search")).toBe("/app/search");
  });

  it("allows a path with query string", () => {
    expect(sanitizeRedirect("/app/product/42?tab=nutrition")).toBe(
      "/app/product/42?tab=nutrition",
    );
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(sanitizeRedirect("//evil.com")).toBe("/app/search");
  });

  it.each([
    "/\\evil.com",
    "/%5cevil.com",
    "/%2fevil.com",
    "/app/search\r\nLocation: https://evil.com",
  ])("rejects browser-normalized redirect attacks: %s", (value) => {
    expect(sanitizeRedirect(value)).toBe("/app/search");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeRedirect("https://evil.com")).toBe("/app/search");
  });

  it("rejects javascript: scheme", () => {
    expect(sanitizeRedirect("javascript:alert(1)")).toBe("/app/search");
  });

  it("returns fallback for null", () => {
    expect(sanitizeRedirect(null)).toBe("/app/search");
  });

  it("returns fallback for undefined", () => {
    expect(sanitizeRedirect(undefined)).toBe("/app/search");
  });

  it("returns fallback for empty string", () => {
    expect(sanitizeRedirect("")).toBe("/app/search");
  });

  it("uses custom fallback when provided", () => {
    expect(sanitizeRedirect(null, "/dashboard")).toBe("/dashboard");
  });

  it("normalizes a valid same-origin path", () => {
    expect(sanitizeRedirect("/app/../app/product/42?tab=nutrition#facts")).toBe(
      "/app/product/42?tab=nutrition#facts",
    );
  });
});

describe("sanitizeAuthRedirect", () => {
  it("accepts authenticated app destinations", () => {
    expect(sanitizeAuthRedirect("/app/product/42?tab=nutrition")).toBe(
      "/app/product/42?tab=nutrition",
    );
  });

  it.each(["/app?source=invite", "/app#resume"])(
    "preserves root app query/hash state: %s",
    (value) => {
      expect(sanitizeAuthRedirect(value)).toBe(value);
    },
  );

  it.each(["/auth/login", "/auth/callback", "/", "/legal/privacy"])(
    "rejects auth loops and public destinations: %s",
    (value) => {
      expect(sanitizeAuthRedirect(value)).toBe("/app/search");
    },
  );
});

describe("appendAuthRedirect", () => {
  it("preserves existing auth query parameters", () => {
    expect(
      appendAuthRedirect("/auth/login?msg=password-updated", "/app/product/42"),
    ).toBe("/auth/login?msg=password-updated&redirect=%2Fapp%2Fproduct%2F42");
  });

  it("sanitizes the post-auth destination", () => {
    expect(appendAuthRedirect("/auth/forgot-password", "https://evil.com")).toBe(
      "/auth/forgot-password?redirect=%2Fapp%2Fsearch",
    );
  });

  it("rejects non-auth navigation paths", () => {
    expect(() => appendAuthRedirect("/app/search", "/app/search")).toThrow(
      /inside \/auth/u,
    );
  });
});

// ─── isValidEan ─────────────────────────────────────────────────────────────

describe("isValidEan", () => {
  it("accepts a valid EAN-13", () => {
    expect(isValidEan("5901234123457")).toBe(true);
  });

  it("accepts a valid EAN-8", () => {
    expect(isValidEan("96385074")).toBe(true);
  });

  it("rejects 7 digits", () => {
    expect(isValidEan("1234567")).toBe(false);
  });

  it("rejects 9 digits", () => {
    expect(isValidEan("123456789")).toBe(false);
  });

  it("accepts 12 digits (UPC-A)", () => {
    expect(isValidEan("012345678901")).toBe(true);
  });

  it("rejects non-digit characters", () => {
    expect(isValidEan("59012341234ab")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEan("")).toBe(false);
  });

  it("rejects strings with spaces", () => {
    expect(isValidEan("5901234 123457")).toBe(false);
  });
});

// ─── computeEanCheckDigit ────────────────────────────────────────────────────

describe("computeEanCheckDigit", () => {
  it("computes correct check digit for EAN-13", () => {
    // 5901234123457 → check digit 7
    expect(computeEanCheckDigit("5901234123457")).toBe(7);
  });

  it("computes correct check digit for EAN-8", () => {
    // 96385074 → check digit 4
    expect(computeEanCheckDigit("96385074")).toBe(4);
  });

  it("computes correct check digit for UPC-A", () => {
    // 036000291452 → check digit 2
    expect(computeEanCheckDigit("036000291452")).toBe(2);
  });
});

// ─── isValidEanChecksum ─────────────────────────────────────────────────────

describe("isValidEanChecksum", () => {
  it("returns true for valid EAN-13 checksum", () => {
    expect(isValidEanChecksum("5901234123457")).toBe(true);
  });

  it("returns true for valid EAN-8 checksum", () => {
    expect(isValidEanChecksum("96385074")).toBe(true);
  });

  it("returns true for valid UPC-A checksum", () => {
    expect(isValidEanChecksum("036000291452")).toBe(true);
  });

  it("returns false for invalid check digit", () => {
    expect(isValidEanChecksum("5901234123450")).toBe(false);
  });

  it("returns false for non-barcode strings", () => {
    expect(isValidEanChecksum("abc")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidEanChecksum("")).toBe(false);
  });
});

// ─── stripNonDigits ─────────────────────────────────────────────────────────

describe("stripNonDigits", () => {
  it("removes letters from mixed input", () => {
    expect(stripNonDigits("abc123def456")).toBe("123456");
  });

  it("removes spaces and punctuation", () => {
    expect(stripNonDigits("12-34 56.78")).toBe("12345678");
  });

  it("returns digits unchanged", () => {
    expect(stripNonDigits("5901234123457")).toBe("5901234123457");
  });

  it("returns empty for no digits", () => {
    expect(stripNonDigits("no-digits-here!")).toBe("");
  });
});

// ─── formatSlug ─────────────────────────────────────────────────────────────

describe("formatSlug", () => {
  it("replaces hyphens with spaces", () => {
    expect(formatSlug("seafood-fish")).toBe("seafood fish");
  });

  it("replaces underscores with spaces", () => {
    expect(formatSlug("soft_drinks")).toBe("soft drinks");
  });

  it("handles multiple hyphens", () => {
    expect(formatSlug("nuts-seeds-legumes")).toBe("nuts seeds legumes");
  });

  it("handles multiple underscores", () => {
    expect(formatSlug("chips_and_crisps")).toBe("chips and crisps");
  });

  it("returns string unchanged when no separators", () => {
    expect(formatSlug("cereals")).toBe("cereals");
  });

  it("handles empty string", () => {
    expect(formatSlug("")).toBe("");
  });
});
