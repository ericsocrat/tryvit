import { notFound, redirect } from "next/navigation";

/** Preserve scan-result bookmarks without a second, weaker product interpretation. */
export default async function ScanResultPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  redirect(`/app/product/${id}`);
}
