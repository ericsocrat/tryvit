import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CONSUMER_TABLES } from './recovery-scopes.mjs';
import { checkNativeProductionBinding, containedFile, hash, pendingMigrations, validateDatabaseAccess, validateManifest, validateNativeProductionBinding, validatePendingMigrations, validateProjectBinding, validateRecovery, validateStaging } from './database-release.mjs';

test('native production Git deployment must be explicitly disabled', () => {
  const ref = 'uskvezwftkkudvksmken';
  const branch = { project_ref: ref, is_default: true, git_branch: '' };
  assert.doesNotThrow(() => validateNativeProductionBinding([branch], ref));
  assert.doesNotThrow(() => validateNativeProductionBinding([{ ...branch, git_branch: null }], ref));
  for (const binding of ['main', 'another-branch', undefined, false, ' ']) {
    assert.throws(() => validateNativeProductionBinding([{ ...branch, git_branch: binding }], ref));
  }
  for (const state of [null, {}, [], [branch, branch], [{ ...branch, project_ref: 'wrong' }], [{ ...branch, is_default: false }]]) {
    assert.throws(() => validateNativeProductionBinding(state, ref));
  }
});

test('native deployment query is read-only, bounded, and sanitizes failures', async () => {
  const ref = 'uskvezwftkkudvksmken';
  let called = 0;
  await checkNativeProductionBinding(ref, 'synthetic-token', async (url, options) => {
    called += 1;
    assert.equal(url, `https://api.supabase.com/v1/projects/${ref}/branches`);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
    return { ok: true, json: async () => [{ project_ref: ref, is_default: true, git_branch: '' }] };
  });
  assert.equal(called, 1);
  for (const request of [
    async () => { throw new Error('synthetic-private-upstream-detail'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error('synthetic-private-body'); } }),
  ]) {
    await assert.rejects(checkNativeProductionBinding(ref, 'synthetic-token', request), { message: 'native-deployment-state-unavailable' });
  }
  await assert.rejects(checkNativeProductionBinding('wrong', 'synthetic-token', async () => { throw new Error('must-not-call'); }), { message: 'native-deployment-access-invalid' });
});

test('only staging permits PAT-only CLI credential provisioning', () => {
  assert.doesNotThrow(() => validateDatabaseAccess('staging', undefined, 'synthetic-pat'));
  assert.doesNotThrow(() => validateDatabaseAccess('staging', 'synthetic-password', 'synthetic-pat'));
  assert.doesNotThrow(() => validateDatabaseAccess('production', 'synthetic-password', 'synthetic-pat'));
  for (const password of [undefined, '', ' ']) assert.throws(() => validateDatabaseAccess('production', password, 'synthetic-pat'));
  for (const environment of ['staging', 'production']) {
    for (const token of [undefined, '', ' ']) assert.throws(() => validateDatabaseAccess(environment, 'synthetic-password', token));
  }
  assert.throws(() => validateDatabaseAccess('preview', 'synthetic-password', 'synthetic-pat'));
});

test('shared manifest selects exactly 15 staging and 5 production migrations while validating both sets', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'tryvit-prerequisites-test-'));
  try {
    mkdirSync(path.join(root, 'supabase/migrations'), { recursive: true });
    const createEntry = (version, suffix = 'fixture') => {
      const file = `supabase/migrations/${version}_${suffix}.sql`;
      const sql = `SELECT ${Number(version.slice(-2))};`;
      writeFileSync(path.join(root, file), sql);
      return { path: file, sha256: hash(sql) };
    };
    const prerequisites = Array.from({ length: 10 }, (_, i) => createEntry(`202609010000${String(i).padStart(2, '0')}`));
    const migrations = Array.from({ length: 5 }, (_, i) => createEntry(`202609050000${String(i).padStart(2, '0')}`));
    const manifest = { schemaVersion: 1, scope: 'schema-and-catalog', migrations, stagingPrerequisites: prerequisites };
    const staging = validateManifest(root, manifest, 'staging');
    const production = validateManifest(root, manifest, 'production');
    assert.equal(staging.length, 15);
    assert.equal(production.length, 5);
    assert.deepEqual(staging, [...prerequisites, ...migrations].map(e => path.posix.basename(e.path)));
    assert.deepEqual(validateManifest(root, manifest), production, 'default is production for offline B integration');
    assert.deepEqual(validateManifest(root, { ...manifest, stagingPrerequisites: undefined }, 'staging'), production);
    assert.deepEqual(validateManifest(root, { ...manifest, stagingPrerequisites: [] }, 'staging'), production);
    assert.doesNotThrow(() => validatePendingMigrations(staging, staging));
    assert.doesNotThrow(() => validatePendingMigrations(production, production));
    for (const partial of [[], staging.slice(1), prerequisites.map(e => path.posix.basename(e.path)), production,
      [...staging, '20260906000000_unexpected.sql'], [...staging].reverse()]) {
      assert.throws(() => validatePendingMigrations(partial, staging));
    }
    assert.throws(() => validatePendingMigrations(staging, production));
    assert.throws(() => validateManifest(root, { ...manifest, stagingPrerequisites: null }));
    assert.throws(() => validateManifest(root, { ...manifest, stagingPrerequisites: [...prerequisites].reverse() }));
    assert.throws(() => validateManifest(root, { ...manifest, stagingPrerequisites: [prerequisites[0], prerequisites[0]] }));
    assert.throws(() => validateManifest(root, { ...manifest, stagingPrerequisites: [migrations[0]] }));
    assert.throws(() => validateManifest(root, { ...manifest, stagingPrerequisites: [createEntry('20260906000000')] }));
    assert.throws(() => validateManifest(root, { ...manifest, stagingPrerequisites: [createEntry('20260905000000', 'other')] }));
    assert.throws(() => validateManifest(root, { ...manifest, migrations: [migrations[0], createEntry('20260905000000', 'duplicate')] }));
    assert.throws(() => validateManifest(root, manifest, 'preview'));
    writeFileSync(path.join(root, prerequisites[0].path), 'SELECT 999;');
    assert.throws(() => validateManifest(root, manifest, 'staging'), /migration-digest-mismatch/u);
    assert.throws(() => validateManifest(root, manifest, 'production'), /migration-digest-mismatch/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release environments bind to their exact distinct projects before CLI access', () => {
  const production = 'uskvezwftkkudvksmken';
  const staging = 'rxtaicdpnaqigowdbmsb';
  assert.equal(validateProjectBinding('production', production, staging), production);
  assert.equal(validateProjectBinding('staging', production, staging), staging);
  for (const environment of ['staging', 'production']) {
    for (const refs of [[staging, production], [production, production], [staging, staging],
      [undefined, staging], [production, undefined], ['', staging], [production, ''],
      ['a'.repeat(20), staging], [production, 'b'.repeat(20)]]) {
      assert.throws(() => validateProjectBinding(environment, ...refs), /database-project-binding-mismatch/u);
    }
  }
  assert.throws(() => validateProjectBinding('preview', production, staging), /invalid-release-environment/u);
});

const now = Date.parse('2026-09-05T12:00:00Z');
const manifestHash = 'a'.repeat(64);
const recovery = { schemaVersion: 1, environment: 'production', migrationManifestSha256: manifestHash, scope: 'database', backupSha256: 'b'.repeat(64), restoredBackupSha256: 'b'.repeat(64), restoredAt: '2026-09-05T11:00:00Z', result: 'PASS', method: 'backup-restore', checks: { rowCounts: true, identityReferences: true, representativeValues: true }, storageDisposition: 'not-affected' };
test('genuine recovery receipt is exact, recent and complete', () => {
  assert.doesNotThrow(() => validateRecovery(recovery, manifestHash, 'database', now));
  for (const patch of [{ method: 'seed-rebuild' }, { result: 'FAIL' }, { scope: 'catalog-only' }, { migrationManifestSha256: 'c'.repeat(64) }, { restoredBackupSha256: 'c'.repeat(64) }, { restoredAt: '2026-09-05T13:00:00Z' }, { restoredAt: '2026-09-04T10:00:00Z' }, { checks: {} }, { storageDisposition: undefined }]) {
    assert.throws(() => validateRecovery({ ...recovery, ...patch }, manifestHash, 'database', now));
  }
});
test('schema-and-catalog recovery is explicit and cannot reuse a catalog-only proof', () => {
  const receipt = { ...recovery, scope: 'schema-and-catalog', encryptedBackupSha256: 'c'.repeat(64), catalogSha256: 'd'.repeat(64), restoredCatalogSha256: 'd'.repeat(64),
    checks: { ...recovery.checks, schema: true, grants: true, rls: true, functions: true },
    privateProductionRowsExported: false,
    sourceFingerprints: { schema: 'e'.repeat(64), grants: 'e'.repeat(64), rls: 'e'.repeat(64), functions: 'e'.repeat(64) },
    restoredFingerprints: { schema: 'e'.repeat(64), grants: 'e'.repeat(64), rls: 'e'.repeat(64), functions: 'e'.repeat(64) },
    exclusions: ['privateUserRows', 'historyRows', 'managedAuthServices', 'storageObjects'] };
  assert.doesNotThrow(() => validateRecovery(receipt, manifestHash, 'schema-and-catalog', now));
  assert.throws(() => validateRecovery({ ...recovery, scope: 'schema-and-catalog' }, manifestHash, 'schema-and-catalog', now));
  assert.throws(() => validateRecovery({ ...receipt, restoredCatalogSha256: 'e'.repeat(64) }, manifestHash, 'schema-and-catalog', now));
  assert.throws(() => validateRecovery({ ...receipt, encryptedBackupSha256: undefined }, manifestHash, 'schema-and-catalog', now));
  assert.throws(() => validateRecovery({ ...receipt, checks: { ...receipt.checks, rls: false } }, manifestHash, 'schema-and-catalog', now));
  assert.throws(() => validateRecovery({ ...receipt, exclusions: [] }, manifestHash, 'schema-and-catalog', now));
  assert.throws(() => validateRecovery({ ...receipt, privateProductionRowsExported: true }, manifestHash, 'schema-and-catalog', now));
  assert.throws(() => validateRecovery({ ...receipt, restoredFingerprints: { ...receipt.restoredFingerprints, rls: 'f'.repeat(64) } }, manifestHash, 'schema-and-catalog', now));
  assert.throws(() => validateRecovery(receipt, manifestHash, 'database', now));
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

test('consumer recovery requires the exact expanded tables and authority proof', () => {
  const receipt = { ...recovery, schemaVersion: 2, scopeProfile: 'consumer-v1', scope: 'schema-and-catalog',
    catalogTables: [...CONSUMER_TABLES], catalogTableCount: 17,
    encryptedBackupSha256: 'c'.repeat(64), catalogSha256: 'd'.repeat(64), restoredCatalogSha256: 'd'.repeat(64),
    checks: { ...recovery.checks, schema: true, grants: true, rls: true, functions: true,
      roleAttributes: true, roleMemberships: true, extensionBootstrap: true, syntheticRoles: true },
    privateProductionRowsExported: false,
    sourceFingerprints: { schema: 'e'.repeat(64), grants: 'e'.repeat(64), rls: 'e'.repeat(64), functions: 'e'.repeat(64) },
    restoredFingerprints: { schema: 'e'.repeat(64), grants: 'e'.repeat(64), rls: 'e'.repeat(64), functions: 'e'.repeat(64) },
    exclusions: ['privateUserRows','historyRows','managedAuthServices','storageObjects'] };
  const validate = value => validateRecovery(value, manifestHash, 'schema-and-catalog', now, 'consumer-v1');
  assert.doesNotThrow(() => validate(receipt));
  for (const patch of [{ schemaVersion: 1 }, { scopeProfile: undefined }, { catalogTableCount: 15 },
    { catalogTables: CONSUMER_TABLES.slice(0, 15) },
    { catalogTables: [...CONSUMER_TABLES.slice(0, 16), 'user_preferences'] },
    { catalogTables: [...CONSUMER_TABLES.slice(0, 16), CONSUMER_TABLES[0]] },
    { checks: { ...receipt.checks, roleAttributes: false } }]) assert.throws(() => validate({ ...receipt, ...patch }));
  assert.throws(() => validateRecovery(receipt, manifestHash, 'schema-and-catalog', now));
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
