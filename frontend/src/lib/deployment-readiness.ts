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
 * requires every credential needed by the browser and the server-side health
 * check, so an incomplete deployment always falls back to the safe demo state.
 */
export function getDeploymentReadiness(
  env: NodeJS.ProcessEnv = process.env,
): DeploymentReadiness {
  const requestedMode = env.TRYVIT_DATA_BACKEND_MODE?.trim().toLowerCase();
  const configurationComplete = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY,
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
