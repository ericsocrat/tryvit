import { notFound } from "next/navigation";

import { catalogGateFromProcessEnvironment } from "@/design-system/catalog/catalog-gate";
import { getServerLocale } from "@/lib/server-locale";

import { CatalogShell } from "./catalog/CatalogShell";
import { getCatalogCopy } from "./catalog/registry";

export default async function DevComponentsPage() {
  if (!catalogGateFromProcessEnvironment()) notFound();

  const locale = await getServerLocale();
  return <CatalogShell copy={getCatalogCopy(locale)} />;
}
