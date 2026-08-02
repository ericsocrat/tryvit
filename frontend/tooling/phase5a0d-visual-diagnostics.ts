export type Phase5VisualConsoleSource =
  "app" | "local-service" | "bundled" | "other" | "unattributed";

function consoleSourceClass(
  sourceUrl: string,
  appOrigin: string,
  localServiceOrigin: string | null,
): Phase5VisualConsoleSource {
  if (!sourceUrl) return "unattributed";
  if (sourceUrl.startsWith("webpack-internal:") || sourceUrl.startsWith("blob:")) {
    return "bundled";
  }
  try {
    const origin = new URL(sourceUrl).origin;
    if (origin === appOrigin) return "app";
    if (origin === localServiceOrigin) return "local-service";
    return "other";
  } catch {
    return "other";
  }
}

function cspDirectiveClass(text: string): string {
  return (
    /\b(default-src|script-src(?:-elem|-attr)?|style-src(?:-elem|-attr)?|img-src|font-src|connect-src|media-src|object-src|frame-src|child-src|worker-src|manifest-src|form-action|frame-ancestors|base-uri)\b/iu
      .exec(text)?.[1]
      ?.toLowerCase() ?? "unknown-directive"
  );
}

function cspTargetSchemeClass(text: string): string {
  const preamble = text.split(/because it violates|violates the following/iu, 1)[0] ?? "";
  return /\b(wss?|https?|data|blob):/iu.exec(preamble)?.[1]?.toLowerCase() ?? "unknown-scheme";
}

/**
 * Converts browser console failures into bounded diagnostic codes. Raw console
 * text and URLs can contain local fixture credentials, so they must never be
 * emitted by the guarded visual workflows.
 */
export function safePhase5VisualConsoleErrorCode(input: {
  readonly text: string;
  readonly sourceUrl: string;
  readonly appOrigin: string;
  readonly localServiceOrigin: string | null;
}): string {
  const source = consoleSourceClass(input.sourceUrl, input.appOrigin, input.localServiceOrigin);
  if (/hydration|server rendered html|did not match|didn't match|hydrated but/iu.test(input.text)) {
    return `react-hydration:${source}`;
  }
  if (/failed to load resource/iu.test(input.text)) {
    return `resource-load:${source}`;
  }
  if (/content security policy|refused to/iu.test(input.text)) {
    return `content-security-policy:${cspDirectiveClass(input.text)}:${cspTargetSchemeClass(input.text)}:${source}`;
  }
  return `console-error:${source}`;
}
