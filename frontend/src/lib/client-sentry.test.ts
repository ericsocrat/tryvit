import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  moduleFactory: vi.fn(),
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => {
  sentryMocks.moduleFactory();
  return {
    init: sentryMocks.init,
    captureException: sentryMocks.captureException,
    captureMessage: sentryMocks.captureMessage,
    captureRouterTransitionStart: sentryMocks.captureRouterTransitionStart,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("client Sentry loader", () => {
  it("never evaluates the SDK when the public DSN is blank", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const telemetry = await import("./client-sentry");

    telemetry.initializeClientSentry();
    telemetry.captureClientException(new Error("not reported"), {
      tags: { boundary: "test" },
    });
    telemetry.captureClientMessage("not reported");
    telemetry.captureClientRouterTransitionStart("/app/search", "push");
    await vi.dynamicImportSettled();

    expect(sentryMocks.moduleFactory).not.toHaveBeenCalled();
    expect(sentryMocks.init).not.toHaveBeenCalled();
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
    expect(sentryMocks.captureMessage).not.toHaveBeenCalled();
    expect(sentryMocks.captureRouterTransitionStart).not.toHaveBeenCalled();
  });

  it("never evaluates the SDK outside the browser", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.invalid/1");
    const originalWindow = globalThis.window;
    // @ts-expect-error -- deliberately exercising the server guard.
    delete globalThis.window;

    try {
      const telemetry = await import("./client-sentry");
      telemetry.initializeClientSentry();
      telemetry.captureClientException(new Error("server"));
      await vi.dynamicImportSettled();

      expect(sentryMocks.moduleFactory).not.toHaveBeenCalled();
      expect(sentryMocks.init).not.toHaveBeenCalled();
    } finally {
      globalThis.window = originalWindow;
    }
  });

  it("initializes once and delivers queued exception, message, and router calls", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.invalid/1");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "0.25");
    const telemetry = await import("./client-sentry");
    const error = new Error("queued capture");

    telemetry.captureClientException(error, {
      tags: { boundary: "route-error" },
    });
    telemetry.captureClientMessage("Web Vital: LCP", {
      level: "warning",
      extra: { value: 4200 },
    });
    telemetry.captureClientRouterTransitionStart("/app/product/1", "push");
    telemetry.initializeClientSentry();
    telemetry.initializeClientSentry();
    await vi.dynamicImportSettled();

    expect(sentryMocks.moduleFactory).toHaveBeenCalledOnce();
    expect(sentryMocks.init).toHaveBeenCalledOnce();
    const initOrder = sentryMocks.init.mock.invocationCallOrder[0];
    expect(initOrder).toBeLessThan(sentryMocks.captureException.mock.invocationCallOrder[0]);
    expect(initOrder).toBeLessThan(sentryMocks.captureMessage.mock.invocationCallOrder[0]);
    expect(initOrder).toBeLessThan(
      sentryMocks.captureRouterTransitionStart.mock.invocationCallOrder[0],
    );
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error, {
      tags: { boundary: "route-error" },
    });
    expect(sentryMocks.captureMessage).toHaveBeenCalledWith("Web Vital: LCP", {
      level: "warning",
      extra: { value: 4200 },
    });
    expect(sentryMocks.captureRouterTransitionStart).toHaveBeenCalledWith("/app/product/1", "push");

    const options = sentryMocks.init.mock.calls[0][0];
    expect(options).toMatchObject({
      dsn: "https://public@example.invalid/1",
      enabled: true,
      tracesSampleRate: 0.25,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
    expect(options.ignoreErrors).toEqual([
      "ResizeObserver loop",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection",
      /Loading chunk \d+ failed/,
      /Failed to fetch dynamically imported module/,
      "AbortError",
    ]);
  });

  it("retains client PII and health-breadcrumb scrubbing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.invalid/1");
    const telemetry = await import("./client-sentry");
    telemetry.initializeClientSentry();
    await vi.dynamicImportSettled();

    const options = sentryMocks.init.mock.calls[0][0];
    const event = {
      user: {
        id: "user-1",
        email: "private@example.invalid",
        ip_address: "192.0.2.1",
      },
      breadcrumbs: [
        { message: "navigated to /app" },
        { message: "fetched health_profile data" },
        { message: "loaded allergen list" },
        { message: "checked health_condition" },
        { message: "clicked button" },
      ],
    };

    const scrubbed = options.beforeSend(event, {});

    expect(scrubbed?.user).toEqual({ id: "user-1" });
    expect(scrubbed?.breadcrumbs).toEqual([
      { message: "navigated to /app" },
      { message: "clicked button" },
    ]);
  });
});
