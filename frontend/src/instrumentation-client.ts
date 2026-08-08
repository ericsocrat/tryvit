// ─── Sentry Client-Side Configuration (#183) ───────────────────────────────
// Turbopack-compatible client instrumentation.
// Replaces deprecated sentry.client.config.ts (root-level convention).
// Next.js 15+ loads this file automatically for client-side initialization.
// PII scrubbing: no emails, IPs, or health data in error reports.

import { captureClientRouterTransitionStart, initializeClientSentry } from "@/lib/client-sentry";

initializeClientSentry();

// ── Navigation instrumentation ───────────────────────────────────────────────
// Required by @sentry/nextjs to capture client-side router transitions.
export const onRouterTransitionStart = captureClientRouterTransitionStart;
