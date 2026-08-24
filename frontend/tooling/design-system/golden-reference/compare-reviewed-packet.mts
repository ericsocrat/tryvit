import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

type Entry = Readonly<{
  path: string;
  kind: string;
  bytes: number;
  sha256: string;
  reference?: string;
  state?: string;
  locale?: string;
  theme?: string;
  motion?: string;
}>;

type Manifest = Readonly<{
  sourceSha: string;
  sourceTreeSha: string;
  retainedBytes: number;
  files: readonly Entry[];
  rawFiles: readonly Entry[];
}>;

const priorCommit = "e3b18dbd944a0cfeb7fec16763f6d6a4ff80a591";
const rejectedReviewCommit = "1e9bcb2a95e2c2bf194b01a097429a17bf76ee2e";
const manifestPath = "docs/phase5a2/checkpoint-2/evidence/manifest.json";
const frontendRoot = process.cwd();
const repositoryRoot = path.resolve(frontendRoot, "..");
const currentFilename = path.join(repositoryRoot, ...manifestPath.split("/"));
const outputFilename = path.join(
  repositoryRoot,
  "docs",
  "phase5a2",
  "checkpoint-2",
  "reviews",
  "correction-cycle-1",
  "evidence-comparison.md",
);

function sha256(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function canonicalLf(contents: string): string {
  return contents.replace(/\r\n/gu, "\n");
}

function readManifestAt(commit: string): string {
  const result = spawnSync("git", ["show", `${commit}:${manifestPath}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error("[P5A2_GOLDEN] prior-manifest-unavailable");
  return result.stdout;
}

const priorText = canonicalLf(readManifestAt(priorCommit));
const rejectedReviewText = canonicalLf(readManifestAt(rejectedReviewCommit));
const currentText = canonicalLf(readFileSync(currentFilename, "utf8"));
const prior = JSON.parse(priorText) as Manifest;
const rejectedReview = JSON.parse(rejectedReviewText) as Manifest;
const current = JSON.parse(currentText) as Manifest;
const priorByPath = new Map(prior.files.map((entry) => [entry.path, entry]));
const currentByPath = new Map(current.files.map((entry) => [entry.path, entry]));
const paths = [...new Set([...priorByPath.keys(), ...currentByPath.keys()])]
  .sort((left, right) => left.localeCompare(right, "en"));

const unchanged: Entry[] = [];
const changed: Array<Readonly<{
  path: string;
  status: "added" | "changed" | "removed";
  prior?: Entry;
  current?: Entry;
}>> = [];

for (const filename of paths) {
  const oldEntry = priorByPath.get(filename);
  const newEntry = currentByPath.get(filename);
  if (!oldEntry && newEntry) changed.push({ path: filename, status: "added", current: newEntry });
  else if (oldEntry && !newEntry) changed.push({ path: filename, status: "removed", prior: oldEntry });
  else if (oldEntry && newEntry) {
    if (oldEntry.bytes === newEntry.bytes && oldEntry.sha256 === newEntry.sha256) {
      unchanged.push(newEntry);
    } else changed.push({ path: filename, status: "changed", prior: oldEntry, current: newEntry });
  }
}

const unchangedCanonical = unchanged
  .sort((left, right) => left.path.localeCompare(right.path, "en"))
  .map((entry) => `${entry.path}\t${entry.bytes}\t${entry.sha256}\n`)
  .join("");
const unchangedKinds = new Map<string, number>();
for (const entry of unchanged) unchangedKinds.set(entry.kind, (unchangedKinds.get(entry.kind) ?? 0) + 1);
const changedCount = changed.filter(({ status }) => status === "changed").length;
const addedCount = changed.filter(({ status }) => status === "added").length;
const removedCount = changed.filter(({ status }) => status === "removed").length;

const table = changed.map(({ path: filename, status, prior: oldEntry, current: newEntry }) =>
  `| \`${filename}\` | ${status} | ${oldEntry?.bytes.toLocaleString("en-US") ?? "—"} | ${newEntry?.bytes.toLocaleString("en-US") ?? "—"} | ${oldEntry ? `\`${oldEntry.sha256}\`` : "—"} | ${newEntry ? `\`${newEntry.sha256}\`` : "—"} |`,
).join("\n");

const rejectedRawByPath = new Map(rejectedReview.rawFiles.map((entry) => [entry.path, entry]));
const terminalMetadata = current.rawFiles
  .filter((entry) => entry.kind === "terminal")
  .map((entry) => ({ path: entry.path, prior: rejectedRawByPath.get(entry.path), current: entry }))
  .filter((entry): entry is Readonly<{ path: string; prior: Entry; current: Entry }> =>
    Boolean(entry.prior) && JSON.stringify(entry.prior) !== JSON.stringify(entry.current),
  );
const metadataTable = terminalMetadata.map(({ path: filename, prior: oldEntry, current: newEntry }) =>
  `| \`${filename}\` | ${oldEntry.reference ?? "—"} / ${oldEntry.state ?? "—"} / ${oldEntry.theme ?? "—"} | ${newEntry.reference ?? "—"} / ${newEntry.state ?? "—"} / ${newEntry.theme ?? "—"} |`,
).join("\n");

const output = `# Correction cycle 1 — reviewed-packet hash comparison

This comparison is mechanically generated evidence, not a review score.

## Bindings

- prior reviewed packet source/tree: \`${prior.sourceSha}\` / \`${prior.sourceTreeSha}\`;
- prior canonical-LF manifest SHA-256: \`${sha256(priorText)}\`;
- replacement source/tree: \`${current.sourceSha}\` / \`${current.sourceTreeSha}\`;
- replacement manifest SHA-256: \`${sha256(currentText)}\`.

The prior manifest has ${prior.files.length} listed files and ${prior.retainedBytes.toLocaleString("en-US")} listed bytes. The replacement has ${current.files.length} listed files and ${current.retainedBytes.toLocaleString("en-US")} listed bytes. Including each manifest, packet totals are ${prior.files.length + 1} files / ${(prior.retainedBytes + Buffer.byteLength(priorText)).toLocaleString("en-US")} bytes and ${current.files.length + 1} files / ${(current.retainedBytes + Buffer.byteLength(currentText)).toLocaleString("en-US")} bytes respectively.

## Byte result

- unchanged byte-for-byte: **${unchanged.length}**;
- changed: **${changedCount}**;
- added: **${addedCount}**;
- removed: **${removedCount}**.

The unchanged set by kind is ${[...unchangedKinds.entries()].sort().map(([kind, count]) => `${count} ${kind}`).join(", ")}. For every unchanged entry, path, byte count, and SHA-256 are equal in both manifests.

Canonical unchanged-set proof: ordinal path order, UTF-8 records encoded as \`path<TAB>bytes<TAB>sha256<LF>\`, ${Buffer.byteLength(unchangedCanonical).toLocaleString("en-US")} bytes, SHA-256 \`${sha256(unchangedCanonical)}\`.

Both complete manifests remain the authoritative per-file proof. Historical scorecards are superseded and are not reused.

## Changed and added files

| Path | Status | Old bytes | New bytes | Old SHA-256 | New SHA-256 |
|---|---|---:|---:|---|---|
${table}

## Byte-identical files with corrected metadata

The rejected fresh-review packet was bound to source/tree \`${rejectedReview.sourceSha}\` / \`${rejectedReview.sourceTreeSha}\`, manifest \`${sha256(rejectedReviewText)}\`. These ${terminalMetadata.length} raw terminal stills retain identical media bytes while their manifest metadata changes from captured start state to observed terminal reference/state/theme. Motion mode and locale remain source-bound.

| Path | Prior reference / state / theme | Replacement reference / state / theme |
|---|---|---|
${metadataTable}

The manifest itself changes by construction and is excluded from the listed-file comparison counts.
`;

writeFileSync(outputFilename, output, "utf8");
process.stdout.write(`Wrote correction packet comparison to ${path.relative(repositoryRoot, outputFilename)}\n`);
