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

  it("exchanges the code for a session when code param is present", async () => {
    const res = await GET(makeRequest("/auth/callback?code=abc123"));

    expect(createServerSupabaseClient).toHaveBeenCalled();
    expect(mockExchangeCode).toHaveBeenCalledWith("abc123");
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/app/search");
  });

  it("routes a valid recovery exchange to password update", async () => {
    const res = await GET(makeRequest("/auth/callback?code=recovery-code&type=recovery"));

    expect(mockExchangeCode).toHaveBeenCalledWith("recovery-code");
    expect(new URL(res.headers.get("location")!).pathname).toBe("/auth/update-password");
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
});
