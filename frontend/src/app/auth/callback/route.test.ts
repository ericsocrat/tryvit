import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockExchangeCode } = vi.hoisted(() => ({
  mockExchangeCode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCode },
  }),
}));

// We must import AFTER the mock is set up
import { GET } from "./route";
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("Auth callback GET route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeCode.mockResolvedValue({ data: { session: {} }, error: null });
  });

  it("exchanges the code and preserves the intended app destination", async () => {
    const res = await GET(
      makeRequest("/auth/callback?code=abc123&redirect=%2Fapp%2Fproduct%2F42"),
    );

    expect(createServerSupabaseClient).toHaveBeenCalled();
    expect(mockExchangeCode).toHaveBeenCalledWith("abc123");
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/app/product/42");
  });

  it("does not let a query parameter select the recovery route", async () => {
    const res = await GET(
      makeRequest(
        "/auth/callback?code=recovery-code&type=recovery&redirect=%2Fapp%2Fproduct%2F42",
      ),
    );

    expect(mockExchangeCode).toHaveBeenCalledWith("recovery-code");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/app/product/42");
  });

  it("fails closed to the expired-session state when no code is present", async () => {
    const res = await GET(makeRequest("/auth/callback"));

    expect(createServerSupabaseClient).toHaveBeenCalled();
    expect(mockExchangeCode).toHaveBeenCalledWith("");
    expect(res.status).toBe(307);
    const destination = new URL(res.headers.get("location")!);
    expect(destination.pathname).toBe("/auth/login");
    expect(destination.searchParams.get("reason")).toBe("expired");
  });

  it("fails closed when Supabase returns an exchange error", async () => {
    mockExchangeCode.mockResolvedValue({
      data: { session: null },
      error: new Error("expired code"),
    });

    const res = await GET(makeRequest("/auth/callback?code=expired"));
    const destination = new URL(res.headers.get("location")!);

    expect(destination.pathname).toBe("/auth/login");
    expect(destination.searchParams.get("reason")).toBe("expired");
  });

  it("fails closed when session exchange throws", async () => {
    mockExchangeCode.mockRejectedValue(new Error("auth unavailable"));

    const res = await GET(makeRequest("/auth/callback?code=throws"));
    const destination = new URL(res.headers.get("location")!);

    expect(destination.pathname).toBe("/auth/login");
    expect(destination.searchParams.get("reason")).toBe("expired");
  });

  it("maps signup-disabled OAuth callbacks to the invitation boundary", async () => {
    const res = await GET(
      makeRequest(
        "/auth/callback?error=access_denied&error_code=signup_disabled&redirect=%2Fapp%2Fproduct%2F42",
      ),
    );
    const destination = new URL(res.headers.get("location")!);

    expect(createServerSupabaseClient).not.toHaveBeenCalled();
    expect(destination.pathname).toBe("/auth/login");
    expect(destination.searchParams.get("reason")).toBe("invite-only");
    expect(destination.searchParams.get("redirect")).toBe("/app/product/42");
  });

  it("rejects external redirect values", async () => {
    const res = await GET(
      makeRequest("/auth/callback?code=abc123&redirect=https%3A%2F%2Fevil.com"),
    );
    expect(new URL(res.headers.get("location")!).pathname).toBe("/app/search");
  });
});
