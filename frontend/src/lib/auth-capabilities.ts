import "server-only";

export type SocialAuthProvider = "google";

export interface AuthCapabilities {
  readonly status: "ready" | "unavailable";
  readonly email: boolean;
  readonly providers: readonly SocialAuthProvider[];
  readonly signupDisabled: boolean;
}

const UNAVAILABLE_AUTH_CAPABILITIES: AuthCapabilities = {
  status: "unavailable",
  // Email/password is the required private-beta fallback. A transient settings
  // lookup failure must not lock out existing invited users; only optional
  // providers and signup stay fail-closed.
  email: true,
  providers: [],
  signupDisabled: true,
};

interface PublicAuthSettings {
  readonly disable_signup?: unknown;
  readonly external?: unknown;
}

function parsePublicAuthSettings(value: unknown): AuthCapabilities | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const settings = value as PublicAuthSettings;
  if (typeof settings.disable_signup !== "boolean") return null;
  if (!settings.external || typeof settings.external !== "object") return null;

  const external = settings.external as Record<string, unknown>;
  const providers: SocialAuthProvider[] = [];
  if (external.google === true) providers.push("google");

  return {
    status: "ready",
    email: external.email === true,
    providers,
    signupDisabled: settings.disable_signup,
  };
}

/**
 * Resolve provider controls from Supabase's public Auth settings endpoint.
 * Unknown or malformed state fails closed so production never advertises a
 * provider that is not actually enabled.
 */
export async function getAuthCapabilities(
  fetcher: typeof fetch = fetch,
): Promise<AuthCapabilities> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!rawUrl || !publicKey) return UNAVAILABLE_AUTH_CAPABILITIES;

  let endpoint: URL;
  try {
    endpoint = new URL("/auth/v1/settings", rawUrl);
  } catch {
    return UNAVAILABLE_AUTH_CAPABILITIES;
  }

  try {
    const response = await fetcher(endpoint, {
      next: { revalidate: 60 },
      headers: { apikey: publicKey },
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return UNAVAILABLE_AUTH_CAPABILITIES;

    return (
      parsePublicAuthSettings(await response.json()) ??
      UNAVAILABLE_AUTH_CAPABILITIES
    );
  } catch {
    return UNAVAILABLE_AUTH_CAPABILITIES;
  }
}
