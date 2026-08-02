import { cache } from "react";
import { headers } from "next/headers";

import { resolveLocaleFromAcceptLanguage } from "@/lib/locale";

/** Resolve the request locale once per React server-rendering request. */
export const getServerLocale = cache(async () => {
  const requestHeaders = await headers();
  return resolveLocaleFromAcceptLanguage(requestHeaders.get("accept-language"));
});
