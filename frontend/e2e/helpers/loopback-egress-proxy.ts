import { mkdirSync, writeFileSync } from "node:fs";
import {
  createServer as createHttpServer,
  request as httpRequest,
  type ServerResponse,
} from "node:http";
import { connect as netConnect } from "node:net";
import path from "node:path";
import type { Duplex } from "node:stream";

// Node's type-stripping loader requires the source extension at runtime.
/* prettier-ignore */
// @ts-expect-error TS5097: executed by the safety CLI with strip-types.
import { canonicalizeLoopbackOrigin, classifyForbiddenEgress, type VisualSafetyContract } from "./visual-safety.ts";

const PROXY_CLOSE_TIMEOUT_MS = 2_000;

export interface LoopbackEgressSummary {
  total: number;
  categories: Record<string, number>;
}

export interface LoopbackEgressProxy {
  origin: string;
  summary: LoopbackEgressSummary;
  close: () => Promise<void>;
}

export function containUpstreamProxyFailure(response: ServerResponse): void {
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(502).end();
}

function isCanonicalLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

export async function startLoopbackEgressProxy(
  options: {
    readonly writeViolationMarker?: boolean;
    readonly violationMarkerPath?: string;
    readonly opaqueConnectPolicy?: "violation" | "contain";
    readonly allowedConnectHostnames?: readonly string[];
    readonly allowedLoopbackOrigins?: readonly string[];
    readonly contract?: Pick<VisualSafetyContract, "knownHostedSupabaseOrigins">;
  } = {},
): Promise<LoopbackEgressProxy> {
  const summary: LoopbackEgressSummary = { total: 0, categories: {} };
  const allowedConnectDestinations = new Map(
    (options.allowedConnectHostnames ?? []).map((hostname) => {
      const normalized = hostname.toLowerCase();
      if (
        normalized !== hostname ||
        !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(normalized) ||
        classifyForbiddenEgress(`https://${normalized}`, "http")
      ) {
        throw new Error("[VS_PROXY_ALLOWLIST] invalid-hostname");
      }
      return [normalized, normalized] as const;
    }),
  );
  const allowedLoopbackDestinations = new Map<
    string,
    {
      readonly authority: string;
      readonly connectHostname: "localhost" | "127.0.0.1" | "::1";
      readonly port: number;
      readonly protocol: "http:" | "https:";
    }
  >();
  const allowedLoopbackAuthorities = new Map<
    string,
    { readonly connectHostname: "localhost" | "127.0.0.1" | "::1"; readonly port: number }
  >();
  for (const rawOrigin of options.allowedLoopbackOrigins ?? []) {
    const canonical = canonicalizeLoopbackOrigin(rawOrigin);
    const connectHostname = canonical.hostname === "[::1]" ? "::1" : canonical.hostname;
    const authority =
      canonical.hostname === "[::1]"
        ? `[::1]:${canonical.effectivePort}`
        : `${canonical.hostname}:${canonical.effectivePort}`;
    allowedLoopbackDestinations.set(canonical.origin, {
      authority,
      connectHostname,
      port: canonical.effectivePort,
      protocol: canonical.protocol,
    });
    allowedLoopbackAuthorities.set(authority, {
      connectHostname,
      port: canonical.effectivePort,
    });
  }
  const sockets = new Set<Duplex>();
  const trackSocket = <T extends Duplex>(socket: T): T => {
    if (!sockets.has(socket)) {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
    }
    return socket;
  };
  const destroyTrackedSockets = () => {
    for (const socket of sockets) socket.destroy();
  };
  const record = (category: string) => {
    summary.total += 1;
    summary.categories[category] = (summary.categories[category] ?? 0) + 1;
    if (options.writeViolationMarker !== false) {
      if (!options.violationMarkerPath) {
        throw new Error("[VS_PROXY_MARKER] violation-marker-path-missing");
      }
      mkdirSync(path.dirname(options.violationMarkerPath), { recursive: true });
      writeFileSync(options.violationMarkerPath, `${JSON.stringify(summary, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
    }
  };

  const recordForbidden = (rawUrl: string, transport: "http" | "websocket"): boolean => {
    const violation = classifyForbiddenEgress(rawUrl, transport, options.contract);
    if (!violation) return false;
    record(`proxy-${transport}-${violation.category}`);
    return true;
  };

  const server = createHttpServer((request, response) => {
    const rawTarget = request.url ?? "";
    let target: URL;
    try {
      target = new URL(rawTarget);
    } catch {
      record("proxy-invalid-target");
      response.writeHead(400).end();
      return;
    }
    const rawAuthority = /^http:\/\/([^/?#]+)(?:[/?#]|$)/u.exec(rawTarget)?.[1];
    if (
      target.protocol !== "http:" ||
      target.username ||
      target.password ||
      target.hash ||
      !rawAuthority ||
      rawAuthority !== target.host
    ) {
      record("proxy-invalid-target");
      response.writeHead(400).end();
      return;
    }
    if (!isCanonicalLoopbackHostname(target.hostname)) {
      // Public providers are not part of the Supabase safety incident. They
      // are still denied at this lower-level proxy so a safety run remains
      // network-contained, but only a forbidden Supabase-shaped target turns
      // the run red. Browser routing performs the path-aware first line of
      // defence before a request can reach this fallback.
      recordForbidden(target.href, "http");
      response.writeHead(451).end();
      return;
    }
    const destination = allowedLoopbackDestinations.get(target.origin);
    if (!destination || destination.protocol !== "http:") {
      record("proxy-loopback-target-not-allowed");
      response.writeHead(451).end();
      return;
    }
    const forwardedHeaders = { ...request.headers };
    delete forwardedHeaders["proxy-authorization"];
    delete forwardedHeaders["proxy-connection"];
    forwardedHeaders.host = destination.authority;
    const forwarded = httpRequest(
      {
        protocol: "http:",
        hostname: destination.connectHostname,
        port: destination.port,
        path: `${target.pathname}${target.search}`,
        method: request.method,
        headers: forwardedHeaders,
      },
      (upstream) => {
        response.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(response);
      },
    );
    forwarded.once("socket", (socket) => trackSocket(socket));
    forwarded.on("error", () => containUpstreamProxyFailure(response));
    request.pipe(forwarded);
  });

  server.on("connection", (socket) => trackSocket(socket));

  server.on("connect", (request, socket, head) => {
    trackSocket(socket);
    const authority = request.url ?? "";
    const match = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/u.exec(authority);
    let connectHostname: string | undefined;
    let connectPort: number | undefined;
    if (!match) {
      const parsedAuthority = (() => {
        try {
          const parsed = new URL(`https://${authority}`);
          const effectivePort = Number(parsed.port || "443");
          if (
            parsed.username ||
            parsed.password ||
            parsed.pathname !== "/" ||
            parsed.search ||
            parsed.hash ||
            authority !== `${parsed.hostname}:${effectivePort}`
          ) {
            return null;
          }
          return { parsed, effectivePort };
        } catch {
          return null;
        }
      })();
      const forbiddenRecorded = parsedAuthority
        ? recordForbidden(parsedAuthority.parsed.href, "http")
        : false;
      if (!parsedAuthority) record("proxy-invalid-connect-authority");
      else if (
        !forbiddenRecorded &&
        parsedAuthority.effectivePort === 443 &&
        allowedConnectDestinations.has(parsedAuthority.parsed.hostname)
      ) {
        connectHostname = allowedConnectDestinations.get(parsedAuthority.parsed.hostname);
        connectPort = parsedAuthority.effectivePort;
      } else if (!forbiddenRecorded && options.opaqueConnectPolicy !== "contain") {
        // CONNECT hides the eventual HTTPS path. A custom-domain Supabase
        // request is therefore indistinguishable from another provider here,
        // so any request that bypasses the path-aware browser guard is fatal.
        record("proxy-non-loopback-connect");
      }
      if (!connectHostname || !connectPort) {
        socket.end("HTTP/1.1 451 Unavailable For Legal Reasons\r\n\r\n");
        return;
      }
    } else {
      const allowedDestination = allowedLoopbackAuthorities.get(authority);
      if (!allowedDestination) {
        record("proxy-loopback-target-not-allowed");
        socket.end("HTTP/1.1 451 Unavailable For Legal Reasons\r\n\r\n");
        return;
      }
      connectHostname = allowedDestination.connectHostname;
      connectPort = allowedDestination.port;
    }
    if (connectPort < 1 || connectPort > 65_535) {
      record("proxy-invalid-connect-port");
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    const upstream = trackSocket(netConnect(connectPort, connectHostname));
    upstream.once("connect", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length > 0) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.once("error", () => {
      if (!socket.destroyed) socket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
    });
    socket.once("error", () => upstream.destroy());
    socket.once("close", () => upstream.destroy());
    upstream.once("close", () => socket.destroy());
  });

  // A raw HTTP Upgrade can bypass the ordinary request listener. Chromium uses
  // CONNECT for proxied WebSockets, so an Upgrade arriving here is unexpected:
  // reject it, record it, and never create an upstream socket.
  server.on("upgrade", (request, socket) => {
    trackSocket(socket);
    let websocketTarget = request.url ?? "";
    try {
      const parsed = new URL(websocketTarget);
      if (parsed.protocol === "http:") parsed.protocol = "ws:";
      else if (parsed.protocol === "https:") parsed.protocol = "wss:";
      websocketTarget = parsed.href;
    } catch {
      // The classifier records malformed upgrade targets without reflecting
      // the raw value into output or artifacts.
    }
    if (!recordForbidden(websocketTarget, "websocket")) {
      record("proxy-upgrade-rejected");
    }
    socket.end("HTTP/1.1 451 Unavailable For Legal Reasons\r\n\r\n");
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    destroyTrackedSockets();
    server.close();
    throw new Error("[VS_PROXY_ADDRESS] loopback-proxy-address-invalid");
  }
  let closePromise: Promise<void> | undefined;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    summary,
    close: () => {
      closePromise ??= new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve();
        };
        const timeout = setTimeout(() => {
          destroyTrackedSockets();
          finish(new Error("[VS_PROXY_CLOSE] loopback-proxy-close-timeout"));
        }, PROXY_CLOSE_TIMEOUT_MS);

        try {
          server.close((error) => {
            destroyTrackedSockets();
            finish(error ? new Error("[VS_PROXY_CLOSE] loopback-proxy-close-failed") : undefined);
          });
          destroyTrackedSockets();
        } catch {
          destroyTrackedSockets();
          finish(new Error("[VS_PROXY_CLOSE] loopback-proxy-close-failed"));
        }
      });
      return closePromise;
    },
  };
}
