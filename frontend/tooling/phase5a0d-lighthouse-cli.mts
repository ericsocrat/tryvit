import { existsSync, lstatSync, writeFileSync } from "node:fs";
import path from "node:path";

// Node's type-stripping loader requires the source extension at runtime.
// @ts-expect-error TS5097: executed with `node --experimental-strip-types`.
import {
  compileLighthouseReport,
  formatLighthouseReportMarkdown,
  serializeLighthouseReportJson,
} from "./phase5a0d-lighthouse.ts";

function fail(code: string): never {
  throw new Error(`[P5_LIGHTHOUSE] ${code}`);
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function authorizedPath(candidate: string | undefined, expected: string, label: string): string {
  const resolved = path.resolve(process.cwd(), candidate ?? expected);
  if (resolved !== expected) fail(`${label}-path-not-authorized`);
  return expected;
}

function main(): number {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "aggregate") fail("command-unrecognized");
  const argumentNames = args.map((argument) => argument.split("=", 1)[0]);
  if (
    args.length > 3 ||
    new Set(argumentNames).size !== argumentNames.length ||
    args.some(
      (argument) =>
        !argument.startsWith("--reports-directory=") &&
        !argument.startsWith("--json=") &&
        !argument.startsWith("--markdown="),
    )
  ) {
    fail("argument-unrecognized");
  }
  const reportsRoot = path.resolve(process.cwd(), "lighthouse-reports");
  const reportsDirectory = authorizedPath(
    argumentValue(args, "reports-directory"),
    reportsRoot,
    "reports-directory",
  );
  const jsonOutput = authorizedPath(
    argumentValue(args, "json"),
    path.join(reportsRoot, "phase5a0d-lighthouse.json"),
    "json-output",
  );
  const markdownOutput = authorizedPath(
    argumentValue(args, "markdown"),
    path.join(reportsRoot, "phase5a0d-lighthouse.md"),
    "markdown-output",
  );
  if (
    existsSync(reportsRoot) &&
    (!lstatSync(reportsRoot).isDirectory() || lstatSync(reportsRoot).isSymbolicLink())
  ) {
    fail("reports-directory-reparse");
  }
  for (const output of [jsonOutput, markdownOutput]) {
    if (existsSync(output) && (!lstatSync(output).isFile() || lstatSync(output).isSymbolicLink())) {
      fail("output-file-reparse");
    }
  }
  const report = compileLighthouseReport(reportsDirectory);
  writeFileSync(jsonOutput, serializeLighthouseReportJson(report), {
    encoding: "utf8",
    mode: 0o600,
  });
  writeFileSync(markdownOutput, formatLighthouseReportMarkdown(report), {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(`Lighthouse report: ${report.reportChecksum}`);
  return report.passed ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "[P5_LIGHTHOUSE] unknown-failure");
  process.exitCode = 1;
}
