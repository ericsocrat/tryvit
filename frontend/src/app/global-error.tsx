// ─── Global error boundary ────────────────────────────────────────────────
// Catches errors in the root layout itself.
// Must include its own <html> and <body> tags.
// Reports to Sentry (#183).

"use client";

import { captureClientException } from "@/lib/client-sentry";
import type { SupportedLanguage } from "@/stores/language-store";
import { useEffect } from "react";

const ERROR_MESSAGES: Record<
  SupportedLanguage,
  { readonly title: string; readonly description: string; readonly retry: string }
> = {
  en: {
    title: "Something went wrong",
    description: "A critical error occurred. Please try again.",
    retry: "Try again",
  },
  pl: {
    title: "Coś poszło nie tak",
    description: "Wystąpił krytyczny błąd. Spróbuj ponownie.",
    retry: "Spróbuj ponownie",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    description: "Ein kritischer Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
    retry: "Erneut versuchen",
  },
};

/** Detect locale from browser language (no React context available in global error boundary). */
function detectClientLocale(): SupportedLanguage {
  if (typeof navigator !== "undefined") {
    const lang = navigator.language.slice(0, 2);
    if (lang === "pl" || lang === "de") return lang;
  }
  return "en";
}

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  const locale = detectClientLocale();
  const messages = ERROR_MESSAGES[locale];

  useEffect(() => {
    captureClientException(error, {
      tags: { boundary: "global-error" },
    });
  }, [error]);
  return (
    <html lang={locale}>
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
            }}
          >
            {messages.title}
          </h1>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>{messages.description}</p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: 500,
            }}
          >
            {messages.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
