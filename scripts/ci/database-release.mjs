import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireThat = (condition, code) => { if (!condition) throw new Error(code); };

export function containedFile(root, relative) {
  requireThat(typeof relative === 'string' && relative.length > 0 && !relative.includes('\\') && !path.isAbsolute(relative) && !relative.split('/').includes('..'), 'unsafe-evidence-path');
  const base = realpathSync(root);
  const target = realpathSync(path.resolve(root, relative));
  requireThat(target.startsWith(`${base}${path.sep}`), 'evidence-outside-checkout');
  return target;
}

export function validateManifest(root, manifest) {
  requireThat(manifest.schemaVersion === 1 && ['catalog-only', 'database'].includes(manifest.scope), 'invalid-migration-manifest');
  requireThat(Array.isArray(manifest.migrations) && manifest.migrations.length > 0, 'empty-migration-manifest');
  const paths = manifest.migrations.map((entry) => entry.path);
  requireThat(new Set(paths).size === paths.length && JSON.stringify(paths) === JSON.stringify([...paths].sort()), 'manifest-order-or-duplicates');
  for (const entry of manifest.migrations) {
    requireThat(/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/u.test(entry.path) && digest.test(entry.sha256 ?? ''), 'invalid-migration-entry');
    requireThat(hash(readFileSync(containedFile(root, entry.path))) === entry.sha256, 'migration-digest-mismatch');
  }
  return paths.map((file) => path.posix.basename(file));
}

export function validateRecovery(receipt, manifestHash, scope, now = Date.now()) {
  requireThat(receipt.schemaVersion === 1 && receipt.environment === 'production' && receipt.method === 'backup-restore' && receipt.result === 'PASS', 'recovery-not-a-successful-backup-restore');
  requireThat(receipt.migrationManifestSha256 === manifestHash && receipt.scope === scope, 'recovery-manifest-or-scope-mismatch');
  requireThat(digest.test(receipt.backupSha256 ?? '') && receipt.restoredBackupSha256 === receipt.backupSha256, 'recovery-backup-mismatch');
  const at = Date.parse(receipt.restoredAt);
  requireThat(typeof receipt.restoredAt === 'string' && /Z$/u.test(receipt.restoredAt) && Number.isFinite(at) && at <= now && now - at <= 24 * 60 * 60 * 1000, 'recovery-outside-24h-window');
  requireThat(['rowCounts', 'identityReferences', 'representativeValues'].every((key) => receipt.checks?.[key] === true), 'recovery-verification-incomplete');
  requireThat(['not-affected', 'separately-verified'].includes(receipt.storageDisposition), 'storage-recovery-unaccounted');
}

export function validateStaging(run, receipt, sourceSha, manifestHash) {
  requireThat(run.path === '.github/workflows/deploy.yml' && run.head_sha === sourceSha && run.event === 'workflow_dispatch' && run.status === 'completed' && run.conclusion === 'success', 'staging-run-not-authoritative');
  requireThat(receipt.schemaVersion === 1 && receipt.environment === 'staging' && receipt.sourceSha === sourceSha && receipt.migrationManifestSha256 === manifestHash && receipt.result === 'PASS' && receipt.dryRun === false && receipt.remainingMigrations === 0 && receipt.lintPassed === true, 'staging-receipt-mismatch');
}

export function pendingMigrations(output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/gu, '');
  const files = [...clean.matchAll(/^\s*•\s+(\d{14}_[a-z0-9_]+\.sql)\s*$/gmu)].map((match) => match[1]);
  requireThat(clean.includes('DRY RUN:') && (!clean.includes('Would push these migrations:') || files.length > 0), 'unrecognized-cli-dry-run');
  return files.sort();
}

// Capture CLI output in memory: database errors can contain rows, SQL literals,
// project references, or credentials. Only stable sanitized codes are printed.
function command(executable, args, code, timeout = 300_000) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout, env: process.env, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  requireThat(!result.error && result.status === 0, code);
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}
function api(endpoint) { return JSON.parse(command('gh', ['api', endpoint], 'github-evidence-query-failed')); }

async function main() {
  const root = process.cwd();
  const { SOURCE_SHA: sourceSha, TARGET_ENVIRONMENT: environment, MIGRATION_MANIFEST: manifestPath, GITHUB_REPOSITORY: repository, GITHUB_ACTOR: actor } = process.env;
  requireThat(sha.test(sourceSha ?? '') && ['staging', 'production'].includes(environment), 'invalid-release-inputs');
  requireThat(process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.GITHUB_REF === 'refs/heads/main', 'release-requires-main-dispatch');
  requireThat(/^[\w.-]+\/[\w.-]+$/u.test(repository ?? '') && /^[\w-]+$/u.test(actor ?? ''), 'invalid-repository-or-actor');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  requireThat(head === sourceSha, 'checkout-source-mismatch');
  const mainSha = api(`repos/${repository}/git/ref/heads/main`).object.sha;
  requireThat(mainSha === sourceSha, 'source-is-not-exact-current-main');
  const permission = api(`repos/${repository}/collaborators/${actor}/permission`).permission;
  requireThat(['admin', 'maintain', 'write'].includes(permission), 'dispatch-actor-not-authorized');
  const manifestBytes = readFileSync(containedFile(root, manifestPath));
  const manifest = JSON.parse(manifestBytes);
  const expected = validateManifest(root, manifest);
  const manifestHash = hash(manifestBytes);
  requireThat(process.env.DRY_RUN === 'true' || process.env.DRY_RUN === 'false', 'invalid-dry-run-value');
  if (environment === 'production' && process.env.DRY_RUN === 'false') {
    validateRecovery(JSON.parse(readFileSync(containedFile(root, process.env.RECOVERY_RECEIPT), 'utf8')), manifestHash, manifest.scope);
    requireThat(/^\d+$/u.test(process.env.STAGING_RUN_ID ?? ''), 'staging-run-required');
    const stagingRun = api(`repos/${repository}/actions/runs/${process.env.STAGING_RUN_ID}`);
    const stagingDir = path.join(process.env.RUNNER_TEMP, 'staging-release-evidence');
    mkdirSync(stagingDir, { recursive: true });
    command('gh', ['run', 'download', process.env.STAGING_RUN_ID, '--repo', repository, '--name', 'database-receipt-staging', '--dir', stagingDir], 'staging-receipt-download-failed');
    const receiptFile = path.join(stagingDir, 'database-receipt.json');
    requireThat(existsSync(receiptFile), 'staging-receipt-missing');
    validateStaging(stagingRun, JSON.parse(readFileSync(receiptFile, 'utf8')), sourceSha, manifestHash);
  }
  const projectRef = environment === 'production' ? process.env.SUPABASE_PROJECT_REF : process.env.SUPABASE_STAGING_PROJECT_REF;
  requireThat(/^[a-z0-9]{20}$/u.test(projectRef ?? '') && process.env.SUPABASE_DB_PASSWORD && process.env.SUPABASE_ACCESS_TOKEN, 'database-access-not-configured');
  command('supabase', ['link', '--project-ref', projectRef], 'database-link-failed');
  const pending = pendingMigrations(command('supabase', ['db', 'push', '--linked', '--dry-run'], 'migration-dry-run-failed'));
  requireThat(JSON.stringify(pending) === JSON.stringify(expected), 'pending-migrations-do-not-match-manifest');
  let lintPassed = false;
  let remainingMigrations = pending.length;
  if (process.env.DRY_RUN === 'false') {
    // Recheck main immediately before mutation; never deploy a stale dispatch.
    requireThat(api(`repos/${repository}/git/ref/heads/main`).object.sha === sourceSha, 'main-moved-before-deployment');
    command('supabase', ['db', 'push', '--linked', '--yes'], 'migration-apply-failed');
    remainingMigrations = pendingMigrations(command('supabase', ['db', 'push', '--linked', '--dry-run'], 'post-migration-check-failed')).length;
    requireThat(remainingMigrations === 0, 'pending-migrations-remain');
    command('supabase', ['db', 'lint', '--linked', '--fail-on', 'error'], 'database-lint-failed');
    lintPassed = true;
  }
  const receipt = { schemaVersion: 1, environment, sourceSha, migrationManifestSha256: manifestHash, result: 'PASS', dryRun: process.env.DRY_RUN === 'true', remainingMigrations, lintPassed, timestamp: new Date().toISOString() };
  writeFileSync(path.join(root, 'database-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`Database ${environment} ${receipt.dryRun ? 'dry run' : 'deployment'}: PASS (${expected.length} migration(s)).\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`Database release stopped: ${/^[a-z0-9-]+$/u.test(error.message) ? error.message : 'invalid-or-unreadable-evidence'}\n`); process.exitCode = 1; });
}
