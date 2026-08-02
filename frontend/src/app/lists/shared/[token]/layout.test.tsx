import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SharedListLayout, { generateMetadata } from "./layout";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockParams = (token: string) => ({ params: Promise.resolve({ token }) });
const sharedListPayload = (listName: string, totalCount: number) => ({
  api_version: "1.0",
  list_name: listName,
  description: null,
  list_type: "custom",
  total_count: totalCount,
  limit: 50,
  offset: 0,
  items: [],
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.restoreAllMocks();
});

// ─── Rendering ───────────────────────────────────────────────────────────────

describe("SharedListLayout", () => {
  it("renders children unchanged", () => {
    render(
      <SharedListLayout>
        <p>list content</p>
      </SharedListLayout>,
    );
    expect(screen.getByText("list content")).toBeInTheDocument();
  });
});

// ─── generateMetadata ────────────────────────────────────────────────────────

describe("generateMetadata", () => {
  it("returns dynamic title with list name when fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sharedListPayload("Healthy Snacks", 12)),
      }),
    );

    const metadata = await generateMetadata(mockParams("abc123"));
    expect(metadata.title).toBe("Healthy Snacks — TryVit List");
    expect(metadata.description).toContain("12");
  });

  it("returns fallback title when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const metadata = await generateMetadata(mockParams("bad-token"));
    expect(metadata.title).toBe("Product List — TryVit List");
  });

  it("returns fallback title when env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const metadata = await generateMetadata(mockParams("abc123"));
    expect(metadata.title).toBe("Product List — TryVit List");
  });

  it("returns generic description when total_count is 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sharedListPayload("Empty List", 0)),
      }),
    );

    const metadata = await generateMetadata(mockParams("abc123"));
    expect(metadata.description).toBe("A curated product list on TryVit");
  });

  it("always sets robots noindex and nofollow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sharedListPayload("Test", 5)),
      }),
    );

    const metadata = await generateMetadata(mockParams("abc123"));
    const robots = metadata.robots as Record<string, unknown>;
    expect(robots.index).toBe(false);
    expect(robots.follow).toBe(false);

    const googleBot = robots.googleBot as Record<string, unknown>;
    expect(googleBot.index).toBe(false);
    expect(googleBot.follow).toBe(false);
  });

  it("includes openGraph fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sharedListPayload("My Favorites", 8)),
      }),
    );

    const metadata = await generateMetadata(mockParams("abc123"));
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBe("My Favorites — TryVit List");
    expect(og.siteName).toBe("TryVit");
    expect(og.type).toBe("website");
  });
});
