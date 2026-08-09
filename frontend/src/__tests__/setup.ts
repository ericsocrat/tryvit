import "@testing-library/jest-dom/vitest";
import de from "@/../messages/de.json";
import en from "@/../messages/en.json";
import pl from "@/../messages/pl.json";
import { translateFromMessages } from "@/lib/i18n-format";
import { useLanguageStore, type SupportedLanguage } from "@/stores/language-store";
import { expect, vi } from "vitest";
import * as vitestAxeMatchers from "vitest-axe/matchers";

// ─── Global test contract: root client messages ────────────────────────────
// Production fails closed without ClientMessagesProvider. Isolated component
// tests intentionally omit the full app shell, so install a locale-aware test
// contract here without adding any static dictionary import to production.
// Language-transition and loading-race tests must mount the real provider.
const testDictionaries = { en, pl, de } as const;
const testMessages = {
  get language(): SupportedLanguage {
    return useLanguageStore.getState().language;
  },
  get t() {
    const language = useLanguageStore.getState().language;
    return (key: string, params?: Record<string, string | number>) =>
      translateFromMessages(testDictionaries[language], en, key, params);
  },
  prepareLanguage: async () => true,
  activateLanguage: async () => true,
};

Object.assign(globalThis, {
  __TRYVIT_CLIENT_MESSAGES_TEST_FALLBACK__: testMessages,
});

// ─── vitest-axe: register toHaveNoViolations matcher ────────────────────────
// The vitest-axe/extend-expect auto-registration is broken in v0.1.0.
// Manually extend expect with the exported matchers.
expect.extend(vitestAxeMatchers);

// ─── Global mock: matchMedia ────────────────────────────────────────────────
// jsdom doesn't implement matchMedia. Provide a minimal stub so hooks like
// useTheme() work in all component tests.
Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ─── Global mock: useAnalytics ──────────────────────────────────────────────
// Auto-mock the analytics hook so every component test gets a no-op track().
// Individual test files can override this with their own vi.mock if needed.
vi.mock("@/hooks/use-analytics", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

// ─── Global mock: ResizeObserver ────────────────────────────────────────────
// jsdom doesn't implement ResizeObserver. Required by Radix UI Tooltip/Popper.
class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// ─── Global mock: DOMRect ───────────────────────────────────────────────────
// Radix Popper calls getBoundingClientRect which returns a stub in jsdom.
// Provide a proper DOMRect for positioning calculations.
if (!globalThis.DOMRect) {
  globalThis.DOMRect = class DOMRect {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    top = 0;
    right = 0;
    bottom = 0;
    left = 0;
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.right = x + width;
      this.bottom = y + height;
      this.left = x;
    }
    toJSON() {
      return {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        top: this.top,
        right: this.right,
        bottom: this.bottom,
        left: this.left,
      };
    }
    static fromRect(rect?: { x?: number; y?: number; width?: number; height?: number }) {
      return new DOMRect(rect?.x, rect?.y, rect?.width, rect?.height);
    }
  } as unknown as typeof DOMRect;
}

// Ensure Element.prototype.hasPointerCapture exists (needed by Radix)
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
