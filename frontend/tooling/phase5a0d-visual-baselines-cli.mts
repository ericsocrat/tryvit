// Node's type-stripping loader requires the source extension at runtime.
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import {
  generateVisualBaselineManifest,
  stageVisualBaselineArtifact,
  verifyVisualBaselineManifest,
} from "./phase5a0d-visual-baselines.ts";

const command = process.argv[2];

try {
  if (command === "stage") {
    if (process.argv.length !== 4) throw new Error("[P5_VISUAL] stage-destination-required");
    const destination = stageVisualBaselineArtifact(process.argv[3]);
    console.log(`Visual baseline artifact staged: ${destination}`);
  } else {
    if (process.argv.length !== 3) throw new Error("[P5_VISUAL] arguments-invalid");
    const manifest =
      command === "generate"
        ? await generateVisualBaselineManifest()
        : command === "verify"
          ? await verifyVisualBaselineManifest()
          : (() => {
              throw new Error("[P5_VISUAL] command-unrecognized");
            })();
    console.log(`Visual baseline manifest: ${manifest.manifestChecksum}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "[P5_VISUAL] unknown-failure");
  process.exitCode = 1;
}
