import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { ShareButton } from "./ShareButton";

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const defaultProps = {
  productName: "Lay's Classic Chips",
  score: 58,
  productId: 123,
  scoreProvenanceDisposition: "confirmed" as const,
};

// globalThis.location.origin is read-only in JSDOM — override via defineProperty
beforeAll(() => {
  Object.defineProperty(globalThis, "location", {
    value: { ...globalThis.location, origin: "https://tryvit.app" },
    writable: true,
  });
});

/* ─── tests ────────────────────────────────────────────────────────────────── */

describe("ShareButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the share button with label text", () => {
    render(<ShareButton {...defaultProps} />);
    expect(screen.getByRole("button")).toHaveTextContent(/Share/i);
  });

  it("has an accessible aria-label", () => {
    render(<ShareButton {...defaultProps} />);
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("calls navigator.share when available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      writable: true,
      configurable: true,
    });

    render(<ShareButton {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(shareMock).toHaveBeenCalledWith(
      {
        url: "https://tryvit.app/app/product/123",
        title: "Lay's Classic Chips — TryVit Score: 42/100",
        text: "Check out Lay's Classic Chips on TryVit — TryVit Score: 42/100",
      },
    );

    // Clean up
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it.each(["provisional", "not_collected", "expired", null] as const)(
    "shares a neutral product reference when score provenance is %s",
    async (scoreProvenanceDisposition) => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", {
        value: shareMock,
        writable: true,
        configurable: true,
      });

      render(
        <ShareButton
          {...defaultProps}
          scoreProvenanceDisposition={scoreProvenanceDisposition}
        />,
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(shareMock).toHaveBeenCalledWith({
        url: "https://tryvit.app/app/product/123",
        title: "Lay's Classic Chips on TryVit",
        text: "View Lay's Classic Chips on TryVit",
      });
      expect(JSON.stringify(shareMock.mock.calls)).not.toContain("TryVit Score");
      expect(JSON.stringify(shareMock.mock.calls)).not.toContain("42/100");
    },
  );

  it("falls back to clipboard when navigator.share is unavailable", async () => {
    // Ensure share is undefined
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<ShareButton {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      "https://tryvit.app/app/product/123",
    );
  });

  it("shows 'Link copied!' text after clipboard copy", async () => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    render(<ShareButton {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent(/copied/i);
    });
  });

  it("does not throw when share is cancelled (AbortError)", async () => {
    const abortError = new DOMException("Share cancelled", "AbortError");
    const shareMock = vi.fn().mockRejectedValue(abortError);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      writable: true,
      configurable: true,
    });

    render(<ShareButton {...defaultProps} />);

    // Should not throw
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(shareMock).toHaveBeenCalled();

    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it("renders the share icon SVG", () => {
    render(<ShareButton {...defaultProps} />);
    const svg = screen.getByRole("button").querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
