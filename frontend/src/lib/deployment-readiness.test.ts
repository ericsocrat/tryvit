import { describe, expect, it } from "vitest";

import { getDeploymentReadiness } from "./deployment-readiness";

const liveEnvironment: NodeJS.ProcessEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "server-only-service-key",
};

describe("getDeploymentReadiness", () => {
  it("reports full readiness only when the complete backend configuration exists", () => {
    expect(getDeploymentReadiness(liveEnvironment)).toEqual({
      application: "available",
      dataBackend: "available",
      fullProduct: "ready",
      mode: "live",
    });
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ])("falls back to demo mode when %s is absent", (missingKey) => {
    const environment = { ...liveEnvironment };
    delete environment[missingKey];

    expect(getDeploymentReadiness(environment)).toEqual({
      application: "available",
      dataBackend: "unavailable",
      fullProduct: "not_ready",
      mode: "demo",
    });
  });

  it("honors the explicit demo-mode kill switch", () => {
    expect(
      getDeploymentReadiness({
        ...liveEnvironment,
        TRYVIT_DATA_BACKEND_MODE: "demo",
      }),
    ).toMatchObject({
      dataBackend: "unavailable",
      fullProduct: "not_ready",
      mode: "demo",
    });
  });

  it("fails safely when the configured mode is not recognized", () => {
    expect(
      getDeploymentReadiness({
        ...liveEnvironment,
        TRYVIT_DATA_BACKEND_MODE: "unexpected",
      }),
    ).toMatchObject({
      dataBackend: "unavailable",
      fullProduct: "not_ready",
      mode: "demo",
    });
  });
});
