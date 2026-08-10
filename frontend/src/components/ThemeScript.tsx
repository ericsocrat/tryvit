import { createThemeBootstrapScript } from "@/design-system/accessibility/theme-contract";

// ─── Inline script to prevent FOUC (Flash of Unstyled Content) ──────────────
// Injected into <head> before React hydrates. Reads the user's theme preference
// from localStorage and applies `data-theme` to <html> immediately.
//
// Why inline? The script must run before the first paint. If we waited for
// React hydration, users would see a flash of light mode before dark applied.

export function ThemeScript() {
  return (
    <script
      id="tryvit-theme-bootstrap"
      dangerouslySetInnerHTML={{ __html: createThemeBootstrapScript() }}
      suppressHydrationWarning
    />
  );
}
