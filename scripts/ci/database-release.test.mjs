import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { containedFile, hash, pendingMigrations, validateManifest, validateRecovery, validateStaging } from './database-release.mjs';

const now = Date.parse('2026-09-05T12:00:00Z');
const manifestHash = 'a'.repeat(64);
const recovery = { schemaVersion: 1, environment: 'production', migrationManifestSha256: manifestHash, scope: 'database', backupSha256: 'b'.repeat(64), restoredBackupSha256: 'b'.repeat(64), restoredAt: '2026-09-05T11:00:00Z', result: 'PASS', method: 'backup-restore', checks: { rowCounts: true, identityReferences: true, representativeValues: true }, storageDisposition: 'not-affected' };
test('genuine recovery receipt is exact, recent and complete', () => {
  assert.doesNotThrow(() => validateRecovery(recovery, manifestHash, 'database', now));
  for (const patch of [{ method: 'seed-rebuild' }, { result: 'FAIL' }, { scope: 'catalog-only' }, { migrationManifestSha256: 'c'.repeat(64) }, { restoredBackupSha256: 'c'.repeat(64) }, { restoredAt: '2026-09-05T13:00:00Z' }, { restoredAt: '2026-09-04T10:00:00Z' }, { checks: {} }, { storageDisposition: undefined }]) {
    assert.throws(() => validateRecovery({ ...recovery, ...patch }, manifestHash, 'database', now));
  }
});
test('staging must be successful actual deployment of same manifest and source', () => {
  const source = 'd'.repeat(40);
  const run = { path: '.github/workflows/deploy.yml', head_sha: source, event: 'workflow_dispatch', status: 'completed', conclusion: 'success' };
  const receipt = { schemaVersion: 1, environment: 'staging', sourceSha: source, migrationManifestSha256: manifestHash, result: 'PASS', dryRun: false, remainingMigrations: 0, lintPassed: true };
  assert.doesNotThrow(() => validateStaging(run, receipt, source, manifestHash));
  for (const patch of [{ dryRun: true }, { remainingMigrations: 1 }, { lintPassed: false }, { sourceSha: 'e'.repeat(40) }]) assert.throws(() => validateStaging(run, { ...receipt, ...patch }, source, manifestHash));
  assert.throws(() => validateStaging({ ...run, conclusion: 'cancelled' }, receipt, source, manifestHash));
  assert.throws(() => validateStaging({ ...run, path: '.github/workflows/dr-drill.yml' }, receipt, source, manifestHash));
});
test('only recognized pinned CLI dry-run output is accepted', () => {
  assert.deepEqual(pendingMigrations('DRY RUN: migrations will *not* be pushed to the database.\nWould push these migrations:\n • 20260905000000_evidence.sql\n'), ['20260905000000_evidence.sql']);
  assert.deepEqual(pendingMigrations('DRY RUN: migrations will *not* be pushed to the database.\n'), []);
  assert.throws(() => pendingMigrations('network failure'));
  assert.throws(() => pendingMigrations('DRY RUN:\nWould push these migrations:\nunknown format'));
});
test('manifest rejects changed bytes, duplicates, ordering and path escape', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'tryvit-release-test-'));
  try {
    mkdirSync(path.join(root, 'supabase/migrations'), { recursive: true });
    const file = 'supabase/migrations/20260905000000_example.sql';
    writeFileSync(path.join(root, file), 'SELECT 1;');
    const entry = { path: file, sha256: hash('SELECT 1;') };
    const manifest = { schemaVersion: 1, scope: 'database', migrations: [entry] };
    assert.deepEqual(validateManifest(root, manifest), ['20260905000000_example.sql']);
    assert.throws(() => validateManifest(root, { ...manifest, migrations: [entry, entry] }));
    assert.throws(() => validateManifest(root, { ...manifest, migrations: [{ ...entry, sha256: 'a'.repeat(64) }] }));
    for (const name of ['../escape', '/absolute', 'supabase\\file']) assert.throws(() => containedFile(root, name));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
