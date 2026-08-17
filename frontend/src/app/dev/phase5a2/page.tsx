import { notFound, redirect } from "next/navigation";

import { phase5A2GateFromProcessEnvironment } from "./phase5a2-gate";

export const dynamic = "force-dynamic";

export default function Phase5A2ReviewIndexPage(): never {
  if (!phase5A2GateFromProcessEnvironment()) notFound();
  redirect("/dev/phase5a2/source-fold/identity?locale=en&theme=light&motion=full");
}
