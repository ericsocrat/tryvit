import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { mockInitializeClientSentry, mockCaptureRouterTransitionStart } = vi.hoisted(() => ({
  mockInitializeClientSentry: vi.fn(),
  mockCaptureRouterTransitionStart: vi.fn(),
}));

vi.mock("@/lib/client-sentry", () => ({
  initializeClientSentry: mockInitializeClientSentry,
  captureClientRouterTransitionStart: mockCaptureRouterTransitionStart,
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("instrumentation-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("starts the guarded client telemetry loader", async () => {
    await import("./instrumentation-client");

    expect(mockInitializeClientSentry).toHaveBeenCalledOnce();
  });

  it("exports the guarded router transition hook", async () => {
    const mod = await import("./instrumentation-client");

    expect(mod.onRouterTransitionStart).toBe(mockCaptureRouterTransitionStart);
  });
});
