import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_CAPTURE_BYTES = 1024 * 1024;

export const LOCAL_SUPABASE_FAILURE_CATEGORIES = Object.freeze([
  "configuration-invalid",
  "container-image-unavailable",
  "docker-daemon-unavailable",
  "migration-failed",
  "network-failure",
  "port-conflict",
  "runner-resource-exhausted",
  "service-health-failed",
  "unclassified",
]);

const RULES = Object.freeze([
  [
    "docker-daemon-unavailable",
    /cannot connect to the docker daemon|docker (?:desktop|daemon) is not running|error during connect|failed to connect to docker|is the docker daemon running/iu,
  ],
  [
    "port-conflict",
    /address already in use|bind for .* failed: port is already allocated|port is already allocated|ports are not available/iu,
  ],
  [
    "container-image-unavailable",
    /failed to pull (?:docker )?image|failed to resolve reference|manifest unknown|pull access denied|registry.*(?:tls handshake timeout|unexpected status)|toomanyrequests/iu,
  ],
  [
    "runner-resource-exhausted",
    /cannot allocate memory|disk quota exceeded|no space left on device|not enough (?:disk space|memory)|oomkilled|out of memory/iu,
  ],
  [
    "migration-failed",
    /error (?:applying|running) migration|failed to apply migration|migration[^\n]*(?:error|failed)|failed to reset database/iu,
  ],
  [
    "configuration-invalid",
    /config\.toml[^\n]*(?:error|invalid)|failed to (?:load|parse|read) (?:the )?(?:supabase )?config|invalid (?:supabase )?config/iu,
  ],
  [
    "service-health-failed",
    /container[^\n]*(?:exited|is not healthy|unhealthy)|failed to start (?:docker )?container|health ?check[^\n]*(?:error|failed|timeout)|timed out waiting for (?:container|service)/iu,
  ],
  [
    "network-failure",
    /connection reset by peer|context deadline exceeded|dial tcp[^\n]*(?:timeout|unreachable)|i\/o timeout|network is unreachable|no such host|temporary failure in name resolution/iu,
  ],
]);

export function classifyLocalSupabaseFailure(output) {
  const text = typeof output === "string" ? output : String(output ?? "");
  for (const [category, pattern] of RULES) {
    if (pattern.test(text)) return category;
  }
  return "unclassified";
}

function readCaptureTail(filename) {
  const descriptor = openSync(filename, "r");
  try {
    const stats = fstatSync(descriptor);
    if (!stats.isFile()) throw new Error("failure-capture-not-regular");
    const length = Math.min(stats.size, MAX_CAPTURE_BYTES);
    const buffer = Buffer.alloc(length);
    const position = Math.max(0, stats.size - length);
    const bytesRead = readSync(descriptor, buffer, 0, length, position);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    closeSync(descriptor);
  }
}

function main(argv) {
  if (argv.length !== 1) return "unclassified";
  try {
    return classifyLocalSupabaseFailure(readCaptureTail(argv[0]));
  } catch {
    return "unclassified";
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  process.stdout.write(`${main(process.argv.slice(2))}\n`);
}
