import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { getHomeReadModel } from "@/lib/evidence/home";
import { emptyHomeFixture, homeFixture } from "@/lib/evidence/home.fixtures";

const loading = vi.hoisted(() => ({ loaded: vi.fn(), release: undefined as undefined | (() => void) }));
vi.mock("@/lib/evidence/home-schema", async (importOriginal) => {
  loading.loaded();
  await new Promise<void>((resolve) => { loading.release = resolve; });
  return importOriginal();
});

it("validates empty homes without the full schema and awaits it before exposing any nonempty response", async () => {
  const rpc = vi.fn();
  const client = { rpc } as unknown as SupabaseClient;
  for (const state of ["not_configured", "preferences_unavailable", "checked"] as const) {
    const empty = emptyHomeFixture();
    empty.saved_allergen_matches.state = state;
    empty.saved_allergen_matches.count = state === "checked" ? 0 : null;
    rpc.mockResolvedValueOnce({ data: empty, error: null });
    await expect(getHomeReadModel(client, "en")).resolves.toEqual({ ok: true, data: empty });
  }
  expect(loading.loaded).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({ data: emptyHomeFixture(), error: null });
  expect(await getHomeReadModel(client, "de")).toMatchObject({ ok: false, error: { code: "RESPONSE_LANGUAGE_MISMATCH" } });
  expect(loading.loaded).not.toHaveBeenCalled();

  rpc.mockClear();
  rpc.mockResolvedValueOnce({ data: homeFixture(), error: null });
  let settled = false;
  const pending = getHomeReadModel(client, "en").then((result) => { settled = true; return result; });
  await vi.waitFor(() => expect(loading.loaded).toHaveBeenCalledOnce());
  expect(settled).toBe(false);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("api_home_read_model", { p_language: "en" });
  loading.release!();
  await expect(pending).resolves.toEqual({ ok: true, data: homeFixture() });

  const bad = homeFixture();
  bad.recently_viewed[0].product_id = 999;
  rpc.mockResolvedValueOnce({ data: bad, error: null });
  expect(await getHomeReadModel(client, "en")).toMatchObject({ ok: false, error: { code: "CONTRACT_MISMATCH" } });
  expect(loading.loaded).toHaveBeenCalledOnce();
});
