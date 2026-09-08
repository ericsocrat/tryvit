import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("retired service worker push boundary", () => {
  const source = readFileSync(join(__dirname, "../app/sw.ts"), "utf8");
  // Execute the exact handler region; exclude Serwist's unrelated cache setup.
  const handlers = source.slice(source.indexOf("// Unsupported score-change"), source.indexOf("// ─── Purge legacy"));
  it("does not parse/display old push claims or renew subscriptions", () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const showNotification = vi.fn(), json = vi.fn();
    runInNewContext(handlers, { self: { addEventListener: (name: string, callback: (event: unknown) => void) => listeners.set(name, callback), registration: { showNotification } } });
    listeners.get("push")?.({ data: { json } });
    expect(json).not.toHaveBeenCalled(); expect(showNotification).not.toHaveBeenCalled();
    expect(listeners.has("pushsubscriptionchange")).toBe(false);
  });
  it("ignores any stored notification URL when opening the explanation", () => {
    const listeners = new Map<string, (event: unknown) => void>(), openWindow = vi.fn().mockResolvedValue(null), close = vi.fn();
    runInNewContext(handlers, { self: { addEventListener: (name: string, callback: (event: unknown) => void) => listeners.set(name, callback), clients: { openWindow } } });
    listeners.get("notificationclick")?.({ notification: { data: { url: "https://untrusted.example/" }, close }, waitUntil: vi.fn() });
    expect(close).toHaveBeenCalledOnce();
    expect(openWindow).toHaveBeenCalledExactlyOnceWith("/app/settings/notifications");
  });
  it("preserves private-response network-only and migration safeguards", () => {
    expect(source).toContain("mustUseNetworkOnly(");
    expect(source).toContain("migratePrivateRuntimeCaches(");
    expect(source.indexOf("handler: privateResponseNetworkOnly")).toBeLessThan(source.indexOf("...defaultCache"));
  });
});
