import { createRetiredPushHandler } from "./retired-handler.ts";

// Keep the deployed function address compatible with existing schedulers.
// No queue read/write, Web Push, VAPID handling, or outbound request remains.
Deno.serve(createRetiredPushHandler(() => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")));
