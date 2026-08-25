import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

vi.mock("next/og", () => {
  const ImageResponseMock = vi.fn().mockImplementation(function (this: Response) {
    return new Response();
  });
  return { ImageResponse: ImageResponseMock };
});

describe("twitter-image root", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("exports the large-card dimensions and truthful alt text", async () => {
    const mod = await import("./twitter-image");
    expect(mod.size).toEqual({ width: 1200, height: 600 });
    expect(mod.contentType).toBe("image/png");
    expect(mod.alt).toMatch(/evidence stays visible/iu);
    expect(mod.alt).toMatch(/źródła pozostają widoczne/iu);
    expect(mod.alt).toMatch(/Evidenz bleibt sichtbar/iu);
  });

  it("renders without a remote font request", async () => {
    const { ImageResponse } = await import("next/og");
    const mod = await import("./twitter-image");
    mod.default();
    expect(ImageResponse).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
