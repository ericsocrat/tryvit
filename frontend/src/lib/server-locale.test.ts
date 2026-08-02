import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ReactTypes from "react";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof ReactTypes>("react");
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

import { getServerLocale } from "./server-locale";

describe("getServerLocale", () => {
  beforeEach(() => {
    mocks.headers.mockReset();
  });

  it("resolves the request Accept-Language header", async () => {
    mocks.headers.mockResolvedValue(new Headers({ "accept-language": "de-DE, en;q=0.8" }));

    await expect(getServerLocale()).resolves.toBe("de");
  });

  it("uses the deterministic fallback when the header is absent", async () => {
    mocks.headers.mockResolvedValue(new Headers());

    await expect(getServerLocale()).resolves.toBe("en");
  });
});
