import { describe, expect, it } from "vitest";

import { localVisualSupabaseCspSources } from "../tooling/local-visual-csp";
import { safePhase5VisualConsoleErrorCode } from "../tooling/phase5a0d-visual-diagnostics";

const origins = {
  appOrigin: "http://127.0.0.1:3000",
  localServiceOrigin: "http://127.0.0.1:54321",
} as const;

describe("localVisualSupabaseCspSources", () => {
  it.each([
    ["http://127.0.0.1:55001", "http://127.0.0.1:55001", "ws://127.0.0.1:55001"],
    ["http://localhost:54321", "http://localhost:54321", "ws://localhost:54321"],
    ["http://[::1]:55432", "http://[::1]:55432", "ws://[::1]:55432"],
  ])("derives an exact same-host, same-port Realtime source from %s", (raw, http, ws) => {
    expect(localVisualSupabaseCspSources(raw)).toEqual([http, ws]);
  });

  it.each([
    undefined,
    "",
    "https://127.0.0.1:55001",
    "http://project.supabase.co",
    "http://127.0.0.1:55001/rest/v1",
    "http://user:secret@127.0.0.1:55001",
    "http://127.0.0.1:55001?key=secret",
    "ws://127.0.0.1:55001",
  ])("rejects a non-canonical or non-loopback input without echoing it", (raw) => {
    let message = "";
    try {
      localVisualSupabaseCspSources(raw);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/^local visual-safety Supabase origin/u);
    if (raw) expect(message).not.toContain(raw);
    expect(message).not.toContain("secret");
  });

  it("never emits wildcards or hosted sources", () => {
    const sources = localVisualSupabaseCspSources("http://127.0.0.1:55001");
    expect(sources.join(" ")).not.toContain("*");
    expect(sources.join(" ")).not.toContain("supabase.co");
  });
});

describe("safePhase5VisualConsoleErrorCode", () => {
  it("reports only a bounded CSP directive and target scheme", () => {
    const secret = "fixture-secret-that-must-not-be-emitted";
    const code = safePhase5VisualConsoleErrorCode({
      ...origins,
      sourceUrl: "",
      text: `Refused to connect to 'ws://127.0.0.1:54321/realtime/v1?apikey=${secret}' because it violates the following Content Security Policy directive: \"connect-src 'self'\".`,
    });

    expect(code).toBe("content-security-policy:connect-src:ws:unattributed");
    expect(code).not.toContain(secret);
    expect(code).not.toContain("54321");
  });

  it("preserves safe source classes for non-CSP failures", () => {
    expect(
      safePhase5VisualConsoleErrorCode({
        ...origins,
        sourceUrl: "http://127.0.0.1:3000/_next/static/chunk.js",
        text: "Hydration failed because the server rendered HTML did not match the client.",
      }),
    ).toBe("react-hydration:app");

    expect(
      safePhase5VisualConsoleErrorCode({
        ...origins,
        sourceUrl: "http://127.0.0.1:54321/rest/v1/example",
        text: "Failed to load resource",
      }),
    ).toBe("resource-load:local-service");
  });

  it("does not echo an unclassified console message", () => {
    const secret = "do-not-log-this";
    const code = safePhase5VisualConsoleErrorCode({
      ...origins,
      sourceUrl: "",
      text: secret,
    });

    expect(code).toBe("console-error:unattributed");
    expect(code).not.toContain(secret);
  });
});
