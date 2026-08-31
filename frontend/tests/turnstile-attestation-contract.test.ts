import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const routeRoot = join(
  process.cwd(),
  "src",
  "app",
  "app",
  "admin",
  "turnstile-attestation",
);
const pageSource = readFileSync(join(routeRoot, "page.tsx"), "utf8");
const clientSource = readFileSync(
  join(routeRoot, "TurnstileAttestation.client.tsx"),
  "utf8",
);
const adminLayoutSource = readFileSync(
  join(process.cwd(), "src", "app", "app", "admin", "layout.tsx"),
  "utf8",
);

describe("temporary production Turnstile attestation contract", () => {
  it("stays unlinked, noindex, and inside the existing protected-admin segment", () => {
    expect(pageSource).toContain('robots: { index: false, follow: false }');
    expect(pageSource).toContain('data-route-id="admin-turnstile-attestation"');
    expect(adminLayoutSource).not.toContain("turnstile-attestation");
  });

  it("uses only the existing verifier and has no signup or data-mutation path", () => {
    expect(clientSource).toContain('TURNSTILE_ATTESTATION_ACTION = "signup"');
    expect(clientSource).toContain("verifyTurnstileToken(supabase, token)");
    expect(clientSource).not.toMatch(/auth\.signUp|\/auth\/v1\/signup|\.from\(|\.rpc\(/u);
    expect(clientSource).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/u);
    expect(clientSource).not.toMatch(/console\.|URLSearchParams|useRouter|window\.location/u);
  });

  it("clears the local token reference and emits only sanitized result fields", () => {
    expect(clientSource).toContain("ephemeralToken = null");
    expect(clientSource).toContain('noDataMutation: "PASS"');
    expect(clientSource).not.toContain("token: token");
    expect(clientSource).not.toContain("receivedToken}</");
  });
});
