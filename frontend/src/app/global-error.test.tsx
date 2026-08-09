import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import de from "@/../messages/de.json";
import pl from "@/../messages/pl.json";
import GlobalError from "./global-error";

const mockCaptureClientException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client-sentry", () => ({
  captureClientException: mockCaptureClientException,
}));

describe("GlobalError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders critical error message", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    expect(screen.getByText(/critical error/i)).toBeInTheDocument();
  });

  it("calls reset when clicking try again", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders with an error that has a digest property", () => {
    const error = Object.assign(new Error("crash"), { digest: "abc123" });
    render(<GlobalError error={error} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it.each([
    ["pl-PL", pl],
    ["de-DE", de],
  ] as const)(
    "keeps the compact %s error copy aligned with its dictionary",
    (language, messages) => {
      const languageSpy = vi.spyOn(window.navigator, "language", "get").mockReturnValue(language);

      render(<GlobalError error={new Error("test")} reset={vi.fn()} />);

      expect(
        screen.getByRole("heading", { name: messages.error.somethingWrong }),
      ).toBeInTheDocument();
      expect(screen.getByText(messages.error.critical)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: messages.common.tryAgain })).toBeInTheDocument();
      languageSpy.mockRestore();
    },
  );

  it("renders centered layout with flexbox", () => {
    const { container } = render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    const div = container.querySelector("div");
    expect(div).toHaveStyle({ display: "flex" });
  });

  it("apply the green style on the button", () => {
    render(<GlobalError error={new Error("test")} reset={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Try again" });
    expect(btn).toHaveStyle({ backgroundColor: "#16a34a" });
  });

  it("preserves the global-error telemetry context", () => {
    const error = new Error("global crash");
    render(<GlobalError error={error} reset={vi.fn()} />);

    expect(mockCaptureClientException).toHaveBeenCalledWith(error, {
      tags: { boundary: "global-error" },
    });
  });
});
