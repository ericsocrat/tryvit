// ─── Pure helpers — no framework deps, easy to unit-test ────────────────────

/**
 * Sanitize a redirect parameter to prevent open-redirect attacks.
 * Only relative paths (starting with "/" but NOT "//") are allowed.
 * Returns the fallback if the raw value is missing or invalid.
 */
export function sanitizeRedirect(
  raw: string | null | undefined,
  fallback = "/app/search",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/u.test(raw)) return fallback;

  const pathOnly = raw.split(/[?#]/u, 1)[0] ?? "";
  if (/%(?:2f|5c)/iu.test(pathOnly)) return fallback;

  try {
    const trustedOrigin = new URL("https://tryvit.invalid");
    const resolved = new URL(raw, trustedOrigin);
    if (resolved.origin !== trustedOrigin.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

/** Keep post-auth navigation inside the authenticated application surface. */
export function sanitizeAuthRedirect(
  raw: string | null | undefined,
  fallback = "/app/search",
): string {
  const sanitized = sanitizeRedirect(raw, fallback);
  const pathname = new URL(sanitized, "https://tryvit.invalid").pathname;
  return pathname === "/app" || pathname.startsWith("/app/") ? sanitized : fallback;
}

export function appendAuthRedirect(path: string, redirect: string): string {
  const trustedOrigin = new URL("https://tryvit.invalid");
  const destination = new URL(path, trustedOrigin);
  if (destination.origin !== trustedOrigin.origin || !destination.pathname.startsWith("/auth/")) {
    throw new Error("Auth navigation path must stay inside /auth");
  }
  destination.searchParams.set("redirect", sanitizeAuthRedirect(redirect));
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

/**
 * Returns true if `code` is a valid EAN‑8, UPC‑A (12), or EAN‑13 string.
 */
export function isValidEan(code: string): boolean {
  return /^\d{8}$|^\d{12,13}$/.test(code);
}

/**
 * Compute the GS1 check digit for an EAN-8, UPC-A, or EAN-13 barcode.
 * Full 8/12/13-digit codes and unambiguous 7/11-digit payloads are accepted.
 * A 12-digit input is treated as a complete UPC-A code, not an EAN-13 payload.
 * Returns the expected check digit (0–9).
 */
export function computeEanCheckDigit(digits: string): number {
  const stripped = digits.replace(/\D/g, "");
  const payload =
    stripped.length === 8 ||
    stripped.length === 12 ||
    stripped.length === 13
      ? stripped.slice(0, -1)
      : stripped;
  let sum = 0;
  const isEan13 = payload.length === 12;
  for (let i = 0; i < payload.length; i++) {
    const digit = Number(payload[i]);
    // EAN-13 payload: even zero-based positions use weight 1.
    // UPC-A and EAN-8 payloads: even zero-based positions use weight 3.
    const weight = isEan13 ? (i % 2 === 0 ? 1 : 3) : (i % 2 === 0 ? 3 : 1);
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Validate the check digit of a full EAN-8, UPC-A, or EAN-13 barcode.
 * Returns true if the last digit matches the computed check digit.
 */
export function isValidEanChecksum(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
  const expected = computeEanCheckDigit(code);
  return Number(code[code.length - 1]) === expected;
}

/**
 * Strip non-digit characters from a string.
 * Useful for cleaning EAN input.
 */
export function stripNonDigits(value: string): string {
  return value.replaceAll(/\D/g, "");
}

/**
 * Convert a URL-safe slug (e.g. "seafood-fish") into a display name ("seafood fish").
 */
export function formatSlug(slug: string): string {
  return slug.replaceAll("-", " ").replaceAll("_", " ");
}
