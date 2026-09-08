# send-push-notification — retired dispatcher

This endpoint is deliberately inert under `evidence-first-v1`. The unsupported
aggregate score is no longer a basis for better/worse health notifications.

A POST request must match the existing server-owned service authority exactly.
Missing/incorrect authorization returns 401; unavailable service authority returns
503. Authorized requests return only:

```json
{"processed":0,"status":"retired","reason":"unsupported_aggregate"}
```

There are no queue reads, Web Push calls, subscription writes, VAPID operations,
logs or request-body parsing. Credentials never enter response bodies. This is
not a claim that historical push delivery worked.

Migration `20260905121451_score_interpretation_retirement.sql` also makes the score
notification trigger inert and pending notification RPC return no deliverable
items. Existing watches, preferences, subscriptions, score history and queued
rows remain intact. The browser stops accepting old score payloads and stops
renewing subscriptions. An explicit user action can remove an existing browser
subscription through the normal owner-scoped API.

The endpoint keeps its existing legacy service-key authentication convention;
it does not change deployment authentication settings, rotate keys, or enable
public access. Supabase distinguishes signed-in user JWTs from backend API
authority: [official authorization headers](https://supabase.com/docs/guides/functions/auth-headers)
and [API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys).
A future authenticated notification service needs a separately specified
evidence-backed event contract and correctly implemented Web Push encryption.
Do not restore the historical plaintext payload implementation.

Verification (synthetic credentials only):

```sh
node --experimental-strip-types --test supabase/functions/send-push-notification/retired-handler.test.ts
```

Release order: deploy this inert endpoint before or with the database retirement,
then deploy the frontend. Test locally first. Do not replay old pending queue
rows. Historical rows are preserved for audit, not automatic future delivery.
Restoring dispatch requires an explicit validated replacement; rolling back
unrelated product UI must not re-enable unsupported health notifications.
