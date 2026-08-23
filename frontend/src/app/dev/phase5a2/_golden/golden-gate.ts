import "server-only";

import { phase5A2GateFromProcessEnvironment } from "@/app/dev/phase5a2/phase5a2-gate";

/**
 * Checkpoint 1 intentionally opens in ordinary development. Golden References are
 * stricter: the existing Phase 5A.2 gate must pass and the explicit review flag must
 * be present in every environment.
 */
export function phase5A2GoldenGateFromProcessEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    environment.PHASE5A2_DIRECTION_SELECTION === "1" &&
    phase5A2GateFromProcessEnvironment(environment)
  );
}
