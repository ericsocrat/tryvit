import type { Request, Response } from "@playwright/test";

import type { AuditMode, RouteEntry } from "../routes";

export interface NavigationHop {
  url: string;
  status: number;
}

export function normalizePathAndQuery(value: string): string {
  const url = new URL(value, "http://quality.invalid");
  const compare = (left: string, right: string): number =>
    left < right ? -1 : left > right ? 1 : 0;
  const entries = [...url.searchParams.entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      compare(leftKey, rightKey) || compare(leftValue, rightValue),
  );
  const query = new URLSearchParams(entries).toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export function routeExpectation(
  route: RouteEntry,
  mode: AuditMode,
):
  | { kind: "render"; url: string }
  | { kind: "redirect"; transport: "http" | "client"; chain: readonly string[] } {
  const declared = route.expectedRedirect?.[mode];
  if (!declared) return { kind: "render", url: route.path };
  return "transport" in declared
    ? { kind: "redirect", transport: "client", chain: declared.chain }
    : { kind: "redirect", transport: "http", chain: declared };
}

export function assertNavigationContract({
  appOrigin,
  pageUrl,
  hops,
  expectation,
}: {
  appOrigin: string;
  pageUrl: string;
  hops: readonly NavigationHop[];
  expectation: ReturnType<typeof routeExpectation>;
}): void {
  const expected = expectation.kind === "render" ? [expectation.url] : expectation.chain;
  if (!hops.length) throw new Error("route-navigation-response-missing");
  if (new URL(pageUrl).origin !== appOrigin) throw new Error("route-navigation-origin-mismatch");
  for (const hop of hops) {
    if (new URL(hop.url).origin !== appOrigin) throw new Error("route-navigation-origin-mismatch");
  }
  const normalizedExpected = expected.map(normalizePathAndQuery);
  if (expectation.kind === "render" && hops.length !== 1) {
    throw new Error("route-render-used-redirect");
  }
  if (expectation.kind === "redirect") {
    const actual = hops.map((hop) => normalizePathAndQuery(hop.url));
    const expectedTransportChain =
      expectation.transport === "http" ? normalizedExpected : [normalizedExpected[0]];
    if (JSON.stringify(actual) !== JSON.stringify(expectedTransportChain)) {
      throw new Error(`route-navigation-chain-mismatch:${actual.join(" -> ")}`);
    }
    if (expectation.transport === "http") {
      if (hops.length < 2) throw new Error("route-declared-redirect-absent");
      if (hops.slice(0, -1).some((hop) => hop.status < 300 || hop.status >= 400)) {
        throw new Error("route-intermediate-status-invalid");
      }
    } else if (hops.length !== 1 || hops[0].status < 200 || hops[0].status >= 300) {
      throw new Error("route-client-redirect-transport-invalid");
    }
  } else {
    const actual = hops.map((hop) => normalizePathAndQuery(hop.url));
    if (JSON.stringify(actual) !== JSON.stringify(normalizedExpected)) {
      throw new Error(`route-navigation-chain-mismatch:${actual.join(" -> ")}`);
    }
  }
  const actualPage = normalizePathAndQuery(pageUrl);
  if (actualPage !== normalizedExpected.at(-1)) {
    throw new Error(`route-final-page-mismatch:${actualPage}`);
  }
  const finalStatus = hops.at(-1)?.status ?? 0;
  if (finalStatus < 200 || finalStatus >= 400) throw new Error("route-final-status-invalid");
}

export async function mainDocumentHops(response: Response | null): Promise<NavigationHop[]> {
  if (!response) return [];
  const requests: Request[] = [];
  let request: Request | null = response.request();
  while (request) {
    requests.unshift(request);
    request = request.redirectedFrom();
  }
  return Promise.all(
    requests.map(async (request) => ({
      url: request.url(),
      status: (await request.response())?.status() ?? 0,
    })),
  );
}
