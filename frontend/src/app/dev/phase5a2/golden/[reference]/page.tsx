import { notFound } from "next/navigation";

import {
  isGoldenReference,
  resolveGoldenRouteState,
  type GoldenRouteState,
} from "@/app/dev/phase5a2/_golden/contract";
import { GoldenFrame } from "@/app/dev/phase5a2/_golden/GoldenFrame";
import { phase5A2GoldenGateFromProcessEnvironment } from "@/app/dev/phase5a2/_golden/golden-gate";

export const dynamic = "force-dynamic";

interface GoldenReferencePageProps {
  readonly params: Promise<{ readonly reference: string }>;
  readonly searchParams: Promise<
    Readonly<Record<string, string | readonly string[] | undefined>>
  >;
}

async function SelectedReference({ route }: Readonly<{ route: GoldenRouteState }>) {
  switch (route.reference) {
    case "landing": {
      const { LandingReference } = await import(
        "@/app/dev/phase5a2/_golden/LandingReference"
      );
      return <LandingReference route={route} />;
    }
    case "authentication": {
      const { AuthenticationReference } = await import(
        "@/app/dev/phase5a2/_golden/AuthenticationReference"
      );
      return <AuthenticationReference route={route} />;
    }
    case "home": {
      const { HomeReference } = await import(
        "@/app/dev/phase5a2/_golden/HomeReference"
      );
      return <HomeReference route={route} />;
    }
    case "search": {
      const { SearchReference } = await import(
        "@/app/dev/phase5a2/_golden/SearchReference"
      );
      return <SearchReference route={route} />;
    }
    case "product": {
      const { ProductReference } = await import(
        "@/app/dev/phase5a2/_golden/ProductReference"
      );
      return <ProductReference route={route} />;
    }
    case "scanner": {
      const { ScannerReference } = await import(
        "@/app/dev/phase5a2/_golden/ScannerReference"
      );
      return <ScannerReference route={route} />;
    }
  }
}

export default async function GoldenReferencePage({
  params,
  searchParams,
}: GoldenReferencePageProps) {
  if (!phase5A2GoldenGateFromProcessEnvironment()) notFound();

  const [{ reference }, query] = await Promise.all([params, searchParams]);
  if (!isGoldenReference(reference)) notFound();
  const route = resolveGoldenRouteState(reference, query);
  if (!route) notFound();

  return (
    <GoldenFrame route={route}>
      <SelectedReference route={route} />
    </GoldenFrame>
  );
}
