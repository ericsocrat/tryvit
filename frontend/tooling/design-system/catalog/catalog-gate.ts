export interface CatalogGateEnvironment {
  readonly nodeEnv?: string;
  readonly phase5a1Catalog?: string;
  readonly qaMode?: string;
}

/**
 * The catalog is convenient locally, but a production build must opt in twice:
 * a server-only switch plus the deterministic public QA build switch.
 */
export function isPhase5A1CatalogOpen(environment: CatalogGateEnvironment): boolean {
  if (environment.nodeEnv !== "production") return true;
  return environment.phase5a1Catalog === "1" && environment.qaMode === "1";
}

export function catalogGateFromProcessEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return isPhase5A1CatalogOpen({
    nodeEnv: environment.NODE_ENV,
    phase5a1Catalog: environment.PHASE5A1_CATALOG,
    qaMode: environment.NEXT_PUBLIC_QA_MODE,
  });
}
