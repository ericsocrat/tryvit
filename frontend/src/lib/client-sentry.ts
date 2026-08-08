// Browser-only Sentry loader. The SDK is intentionally absent from the
// initial client graph when no public DSN is configured.

import type * as ClientSentry from "@sentry/nextjs";

type ClientSentryModule = typeof ClientSentry;
type ClientSentryOptions = Parameters<ClientSentryModule["init"]>[0];
type ExceptionContext = Parameters<ClientSentryModule["captureException"]>[1];
type MessageContext = Parameters<ClientSentryModule["captureMessage"]>[1];

const CLIENT_SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

let clientSentryPromise: Promise<ClientSentryModule | null> | undefined;

function createClientSentryOptions(dsn: string): ClientSentryOptions {
  return {
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    enabled: !!dsn,

    // 100% of errors, 10% of transactions (adjustable via env).
    tracesSampleRate: Number.parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),

    // Session replay remains disabled for PII safety.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }

      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter(
          (breadcrumb) =>
            !breadcrumb.message?.includes("health_profile") &&
            !breadcrumb.message?.includes("allergen") &&
            !breadcrumb.message?.includes("health_condition"),
        );
      }

      return event;
    },

    ignoreErrors: [
      "ResizeObserver loop",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection",
      /Loading chunk \d+ failed/,
      /Failed to fetch dynamically imported module/,
      "AbortError",
    ],
  };
}

function loadClientSentry(): Promise<ClientSentryModule | null> | null {
  if (!CLIENT_SENTRY_DSN || typeof globalThis.window === "undefined") {
    return null;
  }

  clientSentryPromise ??= import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init(createClientSentryOptions(CLIENT_SENTRY_DSN));
      return Sentry;
    })
    .catch(() => null);

  return clientSentryPromise;
}

function withClientSentry(capture: (Sentry: ClientSentryModule) => void): void {
  const pendingClient = loadClientSentry();
  if (!pendingClient) return;

  void pendingClient.then((Sentry) => {
    if (!Sentry) return;

    try {
      capture(Sentry);
    } catch {
      // Telemetry must never interfere with application behavior.
    }
  });
}

/** Begin loading and initializing the browser SDK when telemetry is configured. */
export function initializeClientSentry(): void {
  void loadClientSentry();
}

/** Capture a browser exception after the shared SDK promise is initialized. */
export function captureClientException(error: unknown, context?: ExceptionContext): void {
  withClientSentry((Sentry) => {
    Sentry.captureException(error, context);
  });
}

/** Capture a browser message after the shared SDK promise is initialized. */
export function captureClientMessage(message: string, context?: MessageContext): void {
  withClientSentry((Sentry) => {
    Sentry.captureMessage(message, context);
  });
}

/** Next.js client instrumentation hook for App Router navigation tracing. */
export function captureClientRouterTransitionStart(href: string, navigationType: string): void {
  withClientSentry((Sentry) => {
    Sentry.captureRouterTransitionStart(href, navigationType);
  });
}
