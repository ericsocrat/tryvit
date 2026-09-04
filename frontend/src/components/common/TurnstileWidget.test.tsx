import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnstileWidget, TURNSTILE_SCRIPT_SRC } from "./TurnstileWidget";

const mockReset = vi.fn();
const mockRemove = vi.fn();
let mockAutoWidgetLoad = true;

vi.mock("@marsidev/react-turnstile", () => ({
  DEFAULT_ONLOAD_NAME: "onloadTurnstileCallback",
  DEFAULT_SCRIPT_ID: "cf-turnstile-script",
  SCRIPT_URL: "https://challenges.cloudflare.com/turnstile/v0/api.js",
  Turnstile: forwardRef(
    function MockTurnstile(
      {
        siteKey,
        onWidgetLoad,
        onSuccess,
        onError,
        onExpire,
        onUnsupported,
        onTimeout,
        options,
        injectScript,
        scriptOptions,
      }: {
        siteKey: string;
        onWidgetLoad?: (widgetId: string) => void;
        onSuccess?: (token: string) => void;
        onError?: () => void;
        onExpire?: () => void;
        onUnsupported?: () => void;
        onTimeout?: () => void;
        options?: Record<string, unknown>;
        injectScript?: boolean;
        scriptOptions?: { id?: string };
      },
      ref,
    ) {
      useImperativeHandle(ref, () => ({
        remove: mockRemove,
        render: vi.fn(),
        reset: mockReset,
      }));
      useEffect(() => {
        if (mockAutoWidgetLoad) onWidgetLoad?.("widget-id");
      }, [onWidgetLoad]);
      return (
        <div
          data-testid="mock-turnstile"
          data-site-key={siteKey}
          data-action={options?.action as string}
          data-theme={options?.theme as string}
          data-appearance={options?.appearance as string}
          data-size={options?.size as string}
          data-inject-script={String(injectScript)}
          data-script-id={scriptOptions?.id}
        >
          <button data-testid="trigger-success" onClick={() => onSuccess?.("mock-token-abc")}>
            Success
          </button>
          <button data-testid="trigger-error" onClick={() => onError?.()}>
            Error
          </button>
          <button data-testid="trigger-expire" onClick={() => onExpire?.()}>
            Expire
          </button>
          <button data-testid="trigger-unsupported" onClick={() => onUnsupported?.()}>
            Unsupported
          </button>
          <button data-testid="trigger-timeout" onClick={() => onTimeout?.()}>
            Timeout
          </button>
        </div>
      );
    },
  ),
}));

vi.mock("@/lib/turnstile", () => ({
  getTurnstileSiteKey: () => "1x00000000000000000000AA",
}));

type CallbackWindow = Window & {
  onloadTurnstileCallback?: () => void;
};

function setTurnstileApi(available: boolean) {
  Object.defineProperty(window, "turnstile", {
    configurable: true,
    writable: true,
    value: available ? { render: vi.fn() } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAutoWidgetLoad = true;
  document.getElementById("cf-turnstile-script")?.remove();
  delete (window as CallbackWindow).onloadTurnstileCallback;
  setTurnstileApi(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.getElementById("cf-turnstile-script")?.remove();
  delete (window as CallbackWindow).onloadTurnstileCallback;
  setTurnstileApi(false);
});

describe("TurnstileWidget", () => {
  it("renders the wrapper and delegates explicit rendering after the API is ready", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} action="signup" />);

    expect(screen.getByTestId("turnstile-widget")).toBeInTheDocument();
    expect(screen.getByTestId("mock-turnstile")).toHaveAttribute(
      "data-inject-script",
      "false",
    );
    expect(screen.getByTestId("mock-turnstile")).toHaveAttribute(
      "data-script-id",
      "cf-turnstile-script",
    );
    expect(screen.getByTestId("mock-turnstile")).toHaveAttribute(
      "data-action",
      "signup",
    );
  });

  it("passes the site key, theme, appearance, and responsive size", () => {
    render(
      <TurnstileWidget
        onSuccess={vi.fn()}
        appearance="always"
        theme="dark"
        size="compact"
      />,
    );
    const turnstile = screen.getByTestId("mock-turnstile");

    expect(turnstile).toHaveAttribute("data-site-key", "1x00000000000000000000AA");
    expect(turnstile).toHaveAttribute("data-theme", "dark");
    expect(turnstile).toHaveAttribute("data-appearance", "always");
    expect(turnstile).toHaveAttribute("data-size", "compact");
  });

  it("defaults to auto theme and interaction-only appearance", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} />);
    const turnstile = screen.getByTestId("mock-turnstile");

    expect(turnstile).toHaveAttribute("data-theme", "auto");
    expect(turnstile).toHaveAttribute("data-appearance", "interaction-only");
    expect(turnstile).toHaveAttribute("data-size", "normal");
  });

  it("applies className to the wrapper", () => {
    render(<TurnstileWidget onSuccess={vi.fn()} className="flex justify-center" />);
    expect(screen.getByTestId("turnstile-widget")).toHaveClass("flex", "justify-center");
  });

  it("injects only the canonical explicit-render script and waits for readiness", async () => {
    setTurnstileApi(false);
    render(<TurnstileWidget onSuccess={vi.fn()} />);

    const script = document.getElementById("cf-turnstile-script") as HTMLScriptElement;
    expect(script.src).toBe(TURNSTILE_SCRIPT_SRC);
    expect(script.async).toBe(true);
    expect(script.defer).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Loading security check");

    setTurnstileApi(true);
    fireEvent.load(script);

    await waitFor(() => expect(screen.getByTestId("mock-turnstile")).toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("fails closed on script load error and retries with a fresh script", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    setTurnstileApi(false);
    render(<TurnstileWidget onSuccess={vi.fn()} onError={onError} />);

    const firstScript = document.getElementById("cf-turnstile-script") as HTMLScriptElement;
    fireEvent.error(firstScript);

    expect(screen.getByRole("alert")).toHaveTextContent("Security check unavailable");
    expect(onError).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Retry security check" }));
    const secondScript = document.getElementById("cf-turnstile-script");
    expect(firstScript.isConnected).toBe(false);
    expect(secondScript).not.toBe(firstScript);
    expect(screen.getByRole("status")).toHaveTextContent("Loading security check");
  });

  it("fails closed when the script never initializes", () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    setTurnstileApi(false);
    render(<TurnstileWidget onSuccess={vi.fn()} onError={onError} />);

    act(() => vi.advanceTimersByTime(10_000));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("fails closed when the API loads but the widget never renders", () => {
    vi.useFakeTimers();
    mockAutoWidgetLoad = false;
    const onError = vi.fn();
    render(<TurnstileWidget onSuccess={vi.fn()} onError={onError} />);

    act(() => vi.advanceTimersByTime(5_000));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
  });

  it.each(["trigger-error", "trigger-unsupported", "trigger-timeout"])(
    "announces %s without logging error details",
    (trigger) => {
      const onError = vi.fn();
      render(<TurnstileWidget onSuccess={vi.fn()} onError={onError} />);

      fireEvent.click(screen.getByTestId(trigger));
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(onError).toHaveBeenCalledOnce();
    },
  );

  it("passes success only to memory without DOM, URL, storage, or console disclosure", () => {
    const onSuccess = vi.fn();
    const beforeUrl = window.location.href;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    localStorage.clear();
    sessionStorage.clear();
    render(<TurnstileWidget onSuccess={onSuccess} />);
    fireEvent.click(screen.getByTestId("trigger-success"));

    expect(onSuccess).toHaveBeenCalledWith("mock-token-abc");
    expect(screen.getByTestId("turnstile-widget")).not.toHaveTextContent("mock-token-abc");
    expect(window.location.href).toBe(beforeUrl);
    expect(JSON.stringify({ ...localStorage })).not.toContain("mock-token-abc");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("mock-token-abc");
    expect(JSON.stringify([...log.mock.calls, ...warn.mock.calls, ...error.mock.calls])).not.toContain(
      "mock-token-abc",
    );
  });

  it("clears and resets an expired token", () => {
    const onExpire = vi.fn();
    render(<TurnstileWidget onSuccess={vi.fn()} onExpire={onExpire} />);
    fireEvent.click(screen.getByTestId("trigger-expire"));

    expect(onExpire).toHaveBeenCalledOnce();
    expect(mockReset).toHaveBeenCalledOnce();
  });

  it("exposes a reset handle for single-use token retries", () => {
    const ref = createRef<{ reset: () => void }>();
    render(<TurnstileWidget ref={ref} onSuccess={vi.fn()} />);
    ref.current?.reset();
    expect(mockReset).toHaveBeenCalledOnce();
  });

  it("restores a pre-existing script callback when unmounted", () => {
    setTurnstileApi(false);
    const previousOnload = vi.fn();
    (window as CallbackWindow).onloadTurnstileCallback = previousOnload;
    const { unmount } = render(<TurnstileWidget onSuccess={vi.fn()} />);

    unmount();

    expect((window as CallbackWindow).onloadTurnstileCallback).toBe(previousOnload);
  });
});
