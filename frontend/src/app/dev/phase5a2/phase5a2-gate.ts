export interface Phase5A2GateEnvironment {
  readonly nodeEnv?: string;
  readonly directionSelection?: string;
}

export function isPhase5A2DirectionSelectionOpen(
  environment: Phase5A2GateEnvironment,
): boolean {
  if (environment.nodeEnv !== "production") return true;
  return environment.directionSelection === "1";
}

export function phase5A2GateFromProcessEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return isPhase5A2DirectionSelectionOpen({
    nodeEnv: environment.NODE_ENV,
    directionSelection: environment.PHASE5A2_DIRECTION_SELECTION,
  });
}
