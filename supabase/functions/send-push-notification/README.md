# Edge Function: send-push-notification

> **Runtime:** Deno + TypeScript (Supabase Edge Functions)
> **Auth:** Requires `service_role` key (`Authorization: Bearer <service_role_key>`)

## Purpose

Processes the `notification_queue` table and sends Web Push notifications to users with active push subscriptions via the VAPID protocol.

## Trigger

- Cron job (scheduled)
- Database webhook
- Manual invocation

## Request Shape

```jsonc
// POST /functions/v1/send-push-notification
{
  "user_id": "uuid",
  "title": "Notification title",
  "body": "Notification body text",
  "url": "/app/product/123"  // optional deep-link
}
```

## Deploy

```bash
supabase functions deploy send-push-notification --no-verify-jwt
```

## Secrets Required

| Secret              | Description                                       |
| ------------------- | ------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | VAPID public key for Web Push identification      |
| `VAPID_PRIVATE_KEY` | VAPID private key for JWT signing (P-256 ECDSA)   |

```bash
supabase secrets set VAPID_PUBLIC_KEY=<key> VAPID_PRIVATE_KEY=<key>
```
