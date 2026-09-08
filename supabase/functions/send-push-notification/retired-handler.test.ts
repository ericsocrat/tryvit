import { test } from "node:test";
import assert from "node:assert/strict";
import { createRetiredPushHandler } from "./retired-handler.ts";

const fixtureAuthority = "synthetic-test-authority-only";
test("retired dispatcher verifies authority and never emits a notification payload", async () => {
  const handler = createRetiredPushHandler(() => fixtureAuthority);
  const response = await handler(new Request("https://example.invalid/retired", { method: "POST", headers: { Authorization: `Bearer ${fixtureAuthority}` } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 0, status: "retired", reason: "unsupported_aggregate" });
});
test("a bearer prefix alone or an unrelated bearer value does not authorize", async () => {
  const handler = createRetiredPushHandler(() => fixtureAuthority);
  for (const value of ["Bearer", "Bearer unrelated", "Basic unrelated", ""]) {
    const response = await handler(new Request("https://example.invalid/retired", { method: "POST", headers: { Authorization: value } }));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
  }
});
test("missing server authority fails closed", async () => {
  const response = await createRetiredPushHandler(() => undefined)(new Request("https://example.invalid/retired", { method: "POST" }));
  assert.equal(response.status, 503);
});
test("non-POST requests cannot use the dispatcher", async () => {
  const response = await createRetiredPushHandler(() => fixtureAuthority)(new Request("https://example.invalid/retired"));
  assert.equal(response.status, 405);
});
