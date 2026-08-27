import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockExchangeCode } = vi.hoisted(() => ({
  mockExchangeCode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mockExchangeCode },
  }),
}));

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("Auth recovery callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchangeCode.mockResolvedValue({ data: { session: {} }, error: null });
  });

  it("exchanges a recovery code and uses the fixed password route", async () => {
    const response = await GET(
      makeRequest(
        "/auth/recovery/callback?code=recovery-code&redirect=%2Fapp%2Fproduct%2F42",
      ),
    );
    const destination = new URL(response.headers.get("location")!);

    expect(mockExchangeCode).toHaveBeenCalledWith("recovery-code");
    expect(destination.pathname).toBe("/auth/update-password");
    expect(destination.searchParams.get("redirect")).toBe("/app/product/42");
  });

  it("exchanges an empty value and fails closed when code is missing", async () => {
    mockExchangeCode.mockResolvedValue({
      data: { session: null },
      error: new Error("missing code"),
    });
    const response = await GET(makeRequest("/auth/recovery/callback"));
    const destination = new URL(response.headers.get("location")!);

    expect(createServerSupabaseClient).toHaveBeenCalled();
    expect(mockExchangeCode).toHaveBeenCalledWith("");
    expect(destination.pathname).toBe("/auth/login");
    expect(destination.searchParams.get("reason")).toBe("expired");
  });

  it("fails closed when exchange returns an error", async () => {
    mockExchangeCode.mockResolvedValue({
      data: { session: null },
      error: new Error("expired code"),
    });
    const response = await GET(makeRequest("/auth/recovery/callback?code=expired"));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/auth/login");
  });
});
