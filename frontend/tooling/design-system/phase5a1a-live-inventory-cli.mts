import path from "node:path";

// Node's type-stripping loader requires the source extension at runtime.
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import { writeLiveRouteComponentInventory } from "./phase5a1a-live-inventory.ts";

const frontendRoot = path.resolve(import.meta.dirname, "..", "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const inventory = writeLiveRouteComponentInventory(repositoryRoot);

process.stdout.write(
  `Wrote ${inventory.moduleCounts.total} production modules to docs/phase5/live-route-component-inventory.json.\n`,
);
