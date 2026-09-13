import { describe, expect, it } from "vitest";

import {
  LOCAL_SUPABASE_FAILURE_CATEGORIES,
  classifyLocalSupabaseFailure,
} from "../e2e/scripts/local-supabase-failure.mjs";

describe("local Supabase failure classification", () => {
  it.each([
    [
      "docker-daemon-unavailable",
      "Cannot connect to the Docker daemon. Is the docker daemon running?",
    ],
    ["port-conflict", "Bind for 0.0.0.0:54321 failed: port is already allocated"],
    [
      "container-image-unavailable",
      "failed to resolve reference ghcr.io/example/image: manifest unknown",
    ],
    ["runner-resource-exhausted", "write /var/lib/docker: no space left on device"],
    ["migration-failed", "failed to apply migration 20260908085203"],
    ["configuration-invalid", "failed to parse Supabase config: config.toml is invalid"],
    ["service-health-failed", "container tryvit_db is not healthy"],
    ["network-failure", "dial tcp: temporary failure in name resolution"],
    ["unclassified", "an unfamiliar local runtime failure"],
  ] as const)("returns only the bounded %s category", (expected, output) => {
    const result = classifyLocalSupabaseFailure(output);
    expect(result).toBe(expected);
    expect(LOCAL_SUPABASE_FAILURE_CATEGORIES).toContain(result);
  });

  it("never returns captured credential-bearing text", () => {
    const secret = "SUPABASE_SERVICE_ROLE_KEY=not-a-real-test-secret";
    const result = classifyLocalSupabaseFailure(
      `${secret}\nfailed to start docker container: service unhealthy`,
    );
    expect(result).toBe("service-health-failed");
    expect(result).not.toContain(secret);
    expect(result).toMatch(/^[a-z-]+$/u);
  });

  it("prefers a specific image failure over its nested network symptom", () => {
    expect(
      classifyLocalSupabaseFailure(
        "failed to resolve reference ghcr.io/supabase/postgres: TLS handshake timeout",
      ),
    ).toBe("container-image-unavailable");
  });
});
