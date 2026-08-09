/**
 * Derives the only two network sources required by the guarded local Supabase
 * browser runtime. The checked-in HTTP origin remains the sole input; Realtime
 * receives the same exact loopback host and port through its `ws:` counterpart.
 */
export function localVisualSupabaseCspSources(raw: string | undefined): readonly [string, string] {
  const value = raw?.trim();
  if (!value) throw new Error("local visual-safety Supabase origin is missing");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("local visual-safety Supabase origin is invalid");
  }
  if (
    parsed.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("local visual-safety Supabase origin must be loopback HTTP");
  }

  const realtime = new URL(parsed.origin);
  realtime.protocol = "ws:";
  return Object.freeze([parsed.origin, realtime.origin]);
}
