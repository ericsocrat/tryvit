/* eslint-disable no-restricted-imports -- standalone Node cannot resolve the frontend @ alias */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Node's type-stripping loader requires the source extension at runtime.
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import {
  buildGeneratedArtifacts,
  GENERATED_ARTIFACT_PATHS,
} from "../../../src/design-system/tokens/generate.ts";

const frontendRoot = fileURLToPath(new URL("../../../", import.meta.url));
const repositoryRoot = dirname(frontendRoot);
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outputRootIndex = args.indexOf("--output-root");

if (args.includes("--help")) {
  process.stdout.write(
    "Usage: node --experimental-strip-types tooling/design-system/tokens/generate.mts [--check] [--output-root <path>]\n",
  );
  process.exit(0);
}

if (outputRootIndex >= 0 && !args[outputRootIndex + 1]) {
  throw new Error("--output-root requires a path");
}

const outputRoot =
  outputRootIndex >= 0
    ? resolve(process.cwd(), args[outputRootIndex + 1])
    : repositoryRoot;
const artifacts = buildGeneratedArtifacts();

if (checkOnly) {
  const drift: string[] = [];
  for (const artifactPath of GENERATED_ARTIFACT_PATHS) {
    const absolutePath = resolve(outputRoot, artifactPath);
    let current: string | undefined;
    try {
      current = await readFile(absolutePath, "utf8");
    } catch {
      current = undefined;
    }
    if (current !== artifacts[artifactPath]) drift.push(artifactPath);
  }

  if (drift.length > 0) {
    throw new Error(
      `Generated design-token artifacts are stale or missing:\n- ${drift.join("\n- ")}`,
    );
  }
  process.stdout.write("Design-token artifacts are current.\n");
} else {
  for (const artifactPath of GENERATED_ARTIFACT_PATHS) {
    const absolutePath = resolve(outputRoot, artifactPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, artifacts[artifactPath], "utf8");
  }
  process.stdout.write(
    `Generated ${GENERATED_ARTIFACT_PATHS.length} deterministic design-token artifacts.\n`,
  );
}
