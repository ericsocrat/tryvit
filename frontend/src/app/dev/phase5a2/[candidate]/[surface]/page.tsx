import { notFound } from "next/navigation";

import { ReviewFrame } from "@/app/dev/phase5a2/_shared/ReviewFrame";
import {
  isPhase5A2Candidate,
  isPhase5A2Surface,
  resolvePhase5A2RouteState,
  type Phase5A2RouteState,
} from "@/app/dev/phase5a2/_shared/contract";
import { phase5A2GateFromProcessEnvironment } from "@/app/dev/phase5a2/phase5a2-gate";

export const dynamic = "force-dynamic";

interface Phase5A2ReviewPageProps {
  readonly params: Promise<{
    readonly candidate: string;
    readonly surface: string;
  }>;
  readonly searchParams: Promise<
    Readonly<Record<string, string | readonly string[] | undefined>>
  >;
}

async function CandidateDirection({ route }: Readonly<{ route: Phase5A2RouteState }>) {
  switch (route.candidate) {
    case "source-fold": {
      const { SourceFold } = await import(
        "@/app/dev/phase5a2/_directions/source-fold/SourceFold"
      );
      return <SourceFold route={route} />;
    }
    case "evidence-register": {
      const { EvidenceRegister } = await import(
        "@/app/dev/phase5a2/_directions/evidence-register/EvidenceRegister"
      );
      return <EvidenceRegister route={route} />;
    }
    case "open-core": {
      const { OpenCore } = await import(
        "@/app/dev/phase5a2/_directions/open-core/OpenCore"
      );
      return <OpenCore route={route} />;
    }
  }
}

export default async function Phase5A2ReviewPage({
  params,
  searchParams,
}: Phase5A2ReviewPageProps) {
  if (!phase5A2GateFromProcessEnvironment()) notFound();

  const [{ candidate, surface }, query] = await Promise.all([params, searchParams]);
  if (!isPhase5A2Candidate(candidate) || !isPhase5A2Surface(surface)) notFound();

  const route = resolvePhase5A2RouteState(candidate, surface, query);
  if (!route) notFound();

  return (
    <ReviewFrame route={route}>
      <CandidateDirection route={route} />
    </ReviewFrame>
  );
}
