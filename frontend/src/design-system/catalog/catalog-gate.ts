export interface CatalogGateEnvironment {
  readonly nodeEnv?: string;
  readonly phase5a1Catalog?: string;
  readonly qaMode?: string;
}

/**
 * Runtime-safe catalog gate. Local development is open, while a production
 * build requires both the server-only catalog flag and the public QA flag.
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
