import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "./error";

const mockCaptureClientException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client-sentry", () => ({
  captureClientException: mockCaptureClientException,
}));

vi.mock("next/image", () => ({
  default: ({ priority, ...props }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} data-priority={priority ? "true" : "false"} />
  ),
}));

describe("ErrorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders try again button", () => {
    render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("calls reset when clicking try again", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("does not log error outside development", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error={new Error("boom")} reset={vi.fn()} />);
    // In test env NODE_ENV is "test", not "development", so no logging
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders error illustration", () => {
    const { container } = render(<ErrorPage error={new Error("test")} reset={vi.fn()} />);
    const img = container.querySelector("img[data-illustration='server-error']");
    expect(img).toBeTruthy();
  });

  it("preserves the route-error telemetry context", () => {
    const error = new Error("route crash");
    render(<ErrorPage error={error} reset={vi.fn()} />);

    expect(mockCaptureClientException).toHaveBeenCalledWith(error, {
      tags: { boundary: "route-error" },
    });
  });
});
