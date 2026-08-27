import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef, forwardRef, useImperativeHandle } from "react";
import { TurnstileWidget } from "./TurnstileWidget";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock the Turnstile widget from @marsidev/react-turnstile
const mockReset = vi.fn();

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: forwardRef(
    function MockTurnstile(
      {
        siteKey,
        onSuccess,
        onError,
        onExpire,
        options,
      }: {
        siteKey: string;
        onSuccess?: (token: string) => void;
        onError?: () => void;
        onExpire?: () => void;
        options?: Record<string, unknown>;
      },
      ref,
    ) {
      useImperativeHandle(ref, () => ({ reset: mockReset }));
      return (
        <div
          data-testid="mock-turnstile"
          data-site-key={siteKey}
          data-action={options?.action as string}
          data-theme={options?.theme as string}
          data-appearance={options?.appearance as string}
        >
          <button
            data-testid="trigger-success"
            onClick={() => onSuccess?.("mock-token-abc")}
          >
            Success
          </button>
          <button data-testid="trigger-error" onClick={() => onError?.()}>
            Error
          </button>
          <button data-testid="trigger-expire" onClick={() => onExpire?.()}>
            Expire
          </button>
        </div>
      );
    },
  ),
}));

// Mock turnstile lib to provide a known site key
vi.mock("@/lib/turnstile", () => ({
  getTurnstileSiteKey: () => "1x00000000000000000000AA",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Rendering ──────────────────────────────────────────────────────────────

describe("TurnstileWidget", () => {
  it("should render the widget wrapper", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} />);
    expect(screen.getByTestId("turnstile-widget")).toBeInTheDocument();
  });

  it("should render the Turnstile component with site key", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} />);
    const turnstile = screen.getByTestId("mock-turnstile");
    expect(turnstile).toBeInTheDocument();
    expect(turnstile.getAttribute("data-site-key")).toBe(
      "1x00000000000000000000AA",
    );
  });

  it("should pass action to Turnstile options", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} action="signup" />);
    const turnstile = screen.getByTestId("mock-turnstile");
    expect(turnstile.getAttribute("data-action")).toBe("signup");
  });

  it("should pass theme to Turnstile options", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} theme="dark" />);
    const turnstile = screen.getByTestId("mock-turnstile");
    expect(turnstile.getAttribute("data-theme")).toBe("dark");
  });

  it("should default to auto theme", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} />);
    const turnstile = screen.getByTestId("mock-turnstile");
    expect(turnstile.getAttribute("data-theme")).toBe("auto");
  });

  it("should default to interaction-only appearance", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} />);
    const turnstile = screen.getByTestId("mock-turnstile");
    expect(turnstile.getAttribute("data-appearance")).toBe("interaction-only");
  });

  it("should apply className to wrapper div", () => {
    render(
      <TurnstileWidget onSuccess={vi.fn()} className="flex justify-center" />,
    );
    const wrapper = screen.getByTestId("turnstile-widget");
    expect(wrapper.className).toContain("flex justify-center");
  });

  // ─── Callbacks ──────────────────────────────────────────────────────────

  it("should call onSuccess with token", async () => {
    const onSuccess = vi.fn();
    render(<TurnstileWidget onSuccess={onSuccess} />);
    screen.getByTestId("trigger-success").click();
    expect(onSuccess).toHaveBeenCalledWith("mock-token-abc");
  });

  it("should call onError when challenge fails", () => {
    const onError = vi.fn();
    render(<TurnstileWidget onSuccess={vi.fn()} onError={onError} />);
    screen.getByTestId("trigger-error").click();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("should call onExpire when token expires", () => {
    const onExpire = vi.fn();
    render(<TurnstileWidget onSuccess={vi.fn()} onExpire={onExpire} />);
    screen.getByTestId("trigger-expire").click();
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it("should not throw when onError is undefined", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} />);
    expect(() => screen.getByTestId("trigger-error").click()).not.toThrow();
  });

  it("should not throw when onExpire is undefined", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} />);
    expect(() => screen.getByTestId("trigger-expire").click()).not.toThrow();
  });

  it("exposes a reset handle for single-use token retries", () => {
    const ref = createRef<{ reset: () => void }>();
    render(<TurnstileWidget ref={ref} onSuccess={vi.fn()} />);

    ref.current?.reset();

    expect(mockReset).toHaveBeenCalledOnce();
  });
});
