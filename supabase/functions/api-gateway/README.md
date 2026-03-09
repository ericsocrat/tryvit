# Edge Function: api-gateway

> **Issue:** [#478](https://github.com/ericsocrat/tryvit/issues/478)
> **Runtime:** Deno + TypeScript (Supabase Edge Functions)
> **Auth:** Requires authenticated user JWT (`Authorization: Bearer <jwt>`)

## Purpose

Centralized write-path gateway for rate limiting, input validation, CAPTCHA verification, trust evaluation, and request forwarding. **Read operations bypass this gateway entirely.**

## Supported Actions

| Action           | Rate Limit       | Description                                          |
| ---------------- | ---------------- | ---------------------------------------------------- |
| `record-scan`    | 100 / day / user | Record a barcode scan event                          |
| `submit-product` | 10 / day / user  | Submit a new product (EAN checksum + sanitization)   |
| `track-event`    | 10,000 / day     | Track a telemetry event                              |
| `save-search`    | 50 / day / user  | Save a search query                                  |

## Request Shape

```jsonc
// POST /functions/v1/api-gateway
{
  "action": "record-scan",
  // ... action-specific fields
}
```

## Response Shape

```jsonc
// Success
{ "ok": true, "data": { /* action result */ } }

// Error (rate limited, validation failure, auth error)
{ "ok": false, "error": "RATE_LIMITED", "message": "...", "retry_after": 3600 }
```

## Internal RPC Calls

- `check_submission_rate_limit()` — submission velocity check
- `check_scan_rate_limit()` — scan velocity check
- `score_submission_quality()` — quality scoring for submissions
- `check_api_rate_limit()` — generic per-endpoint rate limiter
- `api_admin_batch_reject_user()` — trust enforcement

## Deploy

```bash
supabase functions deploy api-gateway --no-verify-jwt
```

## Secrets Required

None beyond the standard Supabase project URL and anon/service-role keys (auto-injected).
