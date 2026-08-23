import { test } from "./fixtures/safe-test";
import { proveDisposableGlobalSignOutRevocation } from "./helpers/test-user";

test("global sign-out revokes a disposable server refresh session", async () => {
  await proveDisposableGlobalSignOutRevocation();
});
