# Edge Function: verify-turnstile

> **Issue:** [#470](https://github.com/ericsocrat/tryvit/issues/470)
> **Runtime:** Deno + TypeScript (Supabase Edge Functions)
> **Auth:** Public (no JWT required)

## Purpose

Server-side Cloudflare Turnstile CAPTCHA token verification. Called by the frontend before auth operations (signup, password reset) and conditionally before product submissions (low trust / high velocity users).

## Request Shape

```jsonc
// POST /functions/v1/verify-turnstile
{
  "token": "<turnstile-challenge-token>"
}
```

## Response Shape

```jsonc
// Success
{ "valid": true, "challenge_ts": "2026-01-01T00:00:00Z", "hostname": "tryvit.com" }

// Failure
{ "valid": false, "error": "Token verification failed", "error_codes": ["invalid-input-response"] }
```

## Test Keys (CI / Development)

| Key          | Value                                          |
| ------------ | ---------------------------------------------- |
| Site key     | `1x00000000000000000000AA` (always passes)     |
| Secret key   | `1x0000000000000000000000000000000AA` (always passes) |

## Deploy

```bash
supabase functions deploy verify-turnstile --no-verify-jwt
```

## Secrets Required

| Secret                 | Description                         |
| ---------------------- | ----------------------------------- |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side secret key |

```bash
supabase secrets set TURNSTILE_SECRET_KEY=<key>
```
