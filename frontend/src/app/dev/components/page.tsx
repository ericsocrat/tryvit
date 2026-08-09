import { notFound } from "next/navigation";

import { getServerLocale } from "@/lib/server-locale";
import { catalogGateFromProcessEnvironment } from "@/../tooling/design-system/catalog/catalog-gate";

import { CatalogShell } from "./catalog/CatalogShell";
import { getCatalogCopy } from "./catalog/registry";

export default async function DevComponentsPage() {
  if (!catalogGateFromProcessEnvironment()) notFound();

  const locale = await getServerLocale();
  return <CatalogShell copy={getCatalogCopy(locale)} />;
}
