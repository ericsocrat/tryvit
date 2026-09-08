import { describe, expect, it } from "vitest";
import { SavedListSchema, WatchedProductsSchema } from "./collections";
import { savedListFixture, watchedFixture } from "./collections.fixtures";

describe("owner-scoped collection read contracts", () => {
  it("retains archived product, position, notes and timestamps", () => {
    const data = SavedListSchema.parse(savedListFixture());
    expect(data.items[0].product?.is_deprecated).toBe(true);
    expect(data.items[0].position).toBe(10);
    expect(data.items[0].notes).toBe("Morning note");
    expect(data.items[0].added_at).toBe("2025-01-01T12:00:00Z");
  });
  it("allows explicit missing current product while retaining saved membership", () => {
    const data = savedListFixture(); data.items[0].product = null;
    expect(SavedListSchema.parse(data).items[0].notes).toBe("Morning note");
  });
  it("rejects a wrong product object attached to an existing membership ID", () => {
    const data = savedListFixture(); data.items[0].product_id = 99;
    expect(SavedListSchema.safeParse(data).success).toBe(false);
    const watched = watchedFixture(); watched.items[0].product_id = 99;
    expect(WatchedProductsSchema.safeParse(watched).success).toBe(false);
  });
  it("does not accept an empty total for visible membership", () => {
    const data = savedListFixture(); data.total_count = 0;
    expect(SavedListSchema.safeParse(data).success).toBe(false);
  });
});
