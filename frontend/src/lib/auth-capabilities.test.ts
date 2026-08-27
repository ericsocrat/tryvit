import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthCapabilities } from "./auth-capabilities";

afterEach(() => {
  vi.unstubAllEnvs();
});

function configureAuthEnvironment() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
}

describe("getAuthCapabilities", () => {
  it("returns only providers enabled by hosted Auth", async () => {
    configureAuthEnvironment();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          disable_signup: true,
          external: { email: true, google: true },
        }),
        { status: 200 },
      ),
    );

    await expect(getAuthCapabilities(fetcher)).resolves.toEqual({
      status: "ready",
      email: true,
      providers: ["google"],
      signupDisabled: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://project.supabase.co/auth/v1/settings"),
      expect.objectContaining({
        next: { revalidate: 60 },
        headers: { apikey: "public-key" },
      }),
    );
  });

  it("ignores providers outside the approved Google release", async () => {
    configureAuthEnvironment();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          disable_signup: false,
          external: { email: true, google: true, github: true },
        }),
        { status: 200 },
      ),
    );

    await expect(getAuthCapabilities(fetcher)).resolves.toMatchObject({
      status: "ready",
      providers: ["google"],
      signupDisabled: false,
    });
  });

  it.each([
    ["missing environment", undefined],
    ["non-success response", new Response("unavailable", { status: 503 })],
    ["malformed response", new Response(JSON.stringify({ external: {} }))],
  ])("fails closed for %s", async (_label, response) => {
    if (response) configureAuthEnvironment();
    const fetcher = vi.fn().mockResolvedValue(response);

    await expect(getAuthCapabilities(fetcher)).resolves.toEqual({
      status: "unavailable",
      email: true,
      providers: [],
      signupDisabled: true,
    });
  });

  it("fails closed when the settings request throws", async () => {
    configureAuthEnvironment();
    const fetcher = vi.fn().mockRejectedValue(new Error("network unavailable"));

    await expect(getAuthCapabilities(fetcher)).resolves.toMatchObject({
      status: "unavailable",
      email: true,
      providers: [],
    });
  });
});
