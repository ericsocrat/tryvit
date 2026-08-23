import { GOLDEN_COMMON_COPY } from "./common-copy";
import type { GoldenRouteState } from "./contract";
import { SCANNER_COPY } from "./scanner-copy";
import { ScannerExperience } from "./ScannerReference.client";

export function ScannerReference({ route }: Readonly<{ route: GoldenRouteState }>) {
  return (
    <ScannerExperience
      common={GOLDEN_COMMON_COPY[route.locale]}
      copy={SCANNER_COPY[route.locale]}
      route={route}
    />
  );
}
