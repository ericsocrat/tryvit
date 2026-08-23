import { notFound } from "next/navigation";

import { isGoldenAssetBoard } from "@/app/dev/phase5a2/_golden/asset-contract";
import { GoldenAssetBoardView } from "@/app/dev/phase5a2/_golden/GoldenAssetBoard";
import { phase5A2GoldenGateFromProcessEnvironment } from "@/app/dev/phase5a2/_golden/golden-gate";

export const dynamic = "force-dynamic";

export default async function GoldenAssetBoardPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ board: string }>;
  searchParams: Promise<Readonly<Record<string, string | readonly string[] | undefined>>>;
}>) {
  if (!phase5A2GoldenGateFromProcessEnvironment()) notFound();
  const [{ board }, query] = await Promise.all([params, searchParams]);
  if (!isGoldenAssetBoard(board)) notFound();
  if (Object.keys(query).some((key) => key !== "theme")) notFound();
  const theme = typeof query.theme === "string" ? query.theme : "light";
  if (theme !== "light" && theme !== "dark") notFound();
  return <GoldenAssetBoardView board={board} theme={theme} />;
}
