export type DeploymentReadiness = {
  application: "available";
  dataBackend: "available" | "unavailable";
  fullProduct: "ready" | "not_ready";
  mode: "live" | "demo";
};

/**
 * Resolve public product readiness without exposing configuration details.
 *
 * `TRYVIT_DATA_BACKEND_MODE=demo` is an explicit kill switch. Live mode still
 * requires the complete browser-safe Supabase configuration. Server-side
 * health credentials are checked separately by the health route and never
 * influence client rendering.
 */
export function getDeploymentReadiness(
  env: NodeJS.ProcessEnv = process.env,
): DeploymentReadiness {
  const requestedMode = env.TRYVIT_DATA_BACKEND_MODE?.trim().toLowerCase();
  const configurationComplete = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const modePermitsLive = !requestedMode || requestedMode === "live";
  const dataBackendAvailable =
    modePermitsLive && configurationComplete;

  return {
    application: "available",
    dataBackend: dataBackendAvailable ? "available" : "unavailable",
    fullProduct: dataBackendAvailable ? "ready" : "not_ready",
    mode: dataBackendAvailable ? "live" : "demo",
  };
}
