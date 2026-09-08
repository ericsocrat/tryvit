import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { classifyChanges, requiredChecks } from './change-risk.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = (name) => readFileSync(path.join(root, '.github/workflows', name), 'utf8');

test('recovery source changes trigger every path-filtered classifier-required lane', () => {
  const risk = classifyChanges(['scripts/recovery/cohort-production-operator.mjs']);
  assert.ok(Object.values(risk).every(Boolean));
  const required = requiredChecks(risk);
  const lanes = {
    'dependency-audit.yml': ['npm Audit (frontend)', 'pip Audit (Python pipeline)'],
    'qa.yml': ['DB Integrity'],
    'phase5a0d-visual-baselines.yml': ['Verify immutable visual baselines'],
  };
  for (const [file, checks] of Object.entries(lanes)) {
    for (const check of checks) assert.ok(required.includes(check));
    const trigger = workflow(file).match(/\n  pull_request:([\s\S]*?)(?=\n  [a-z_]+:|\n[a-z]|$)/u)?.[1];
    assert.ok(trigger?.includes('"scripts/recovery/**"'), `${file} must trigger for recovery-only PRs`);
  }
});

test('CI explicitly registers bounded recovery suites while excluding Docker integration', () => {
  const source = workflow('pr-gate.yml');
  const suites = readdirSync(path.join(root, 'scripts/recovery')).filter((name) => name.endsWith('.test.mjs') && name !== 'staging-drain-local.test.mjs');
  assert.ok(suites.includes('cohort-production-operator.test.mjs'));
  for (const suite of suites) assert.ok(source.includes(`scripts/recovery/${suite}`), `missing bounded recovery suite: ${suite}`);
  assert.ok(!source.includes('scripts/recovery/*.test.mjs'));
  assert.ok(!source.includes('scripts/recovery/staging-drain-local.test.mjs'));
});

test('consumer source merges cannot automatically promote the frontend before database readiness', () => {
  // The verified Vercel Root Directory is frontend; a repository-root config
  // would not establish this guard. Other branches keep normal preview behavior.
  const config = JSON.parse(readFileSync(path.join(root, 'frontend/vercel.json'), 'utf8'));
  assert.equal(config.git?.deploymentEnabled?.main, false);
  assert.equal(typeof config.git.deploymentEnabled, 'object');
  assert.ok(!Object.hasOwn(config, 'rootDirectory'), 'rootDirectory is a project setting, not supported JSON configuration');
});

test('database password selection chooses the secret name before resolving an empty value', () => {
  const source = workflow('database-deploy-reusable.yml');
  const expression = source.match(/^\s*SUPABASE_DB_PASSWORD:\s*(.+)$/mu)?.[1];
  // Deliberately support only this reviewed selector grammar. Moving secrets
  // into the boolean operands reintroduces cross-environment fallback.
  const parse = value => value?.match(/^\$\{\{\s*secrets\[inputs\.environment == '([^']+)' && '([^']+)' \|\| '([^']+)'\]\s*\}\}$/u);
  const selector = parse(expression);
  assert.ok(selector, 'workflow must select a literal secret name before lookup');
  assert.deepEqual(selector.slice(1), ['production', 'SUPABASE_DB_PASSWORD', 'SUPABASE_STAGING_DB_PASSWORD']);
  const resolve = (environment, secrets) => secrets[environment === selector[1] ? selector[2] : selector[3]] ?? '';
  const both = { SUPABASE_DB_PASSWORD: 'synthetic-prod', SUPABASE_STAGING_DB_PASSWORD: 'synthetic-stage' };
  assert.equal(resolve('production', both), 'synthetic-prod');
  assert.equal(resolve('staging', both), 'synthetic-stage');
  assert.equal(resolve('production', { SUPABASE_STAGING_DB_PASSWORD: 'synthetic-stage' }), '');
  assert.equal(resolve('production', { ...both, SUPABASE_DB_PASSWORD: '' }), '');
  assert.equal(resolve('staging', { SUPABASE_DB_PASSWORD: 'synthetic-prod' }), '');
  assert.equal(resolve('staging', { ...both, SUPABASE_STAGING_DB_PASSWORD: '' }), '');
  assert.equal(parse("${{ inputs.environment == 'production' && secrets.SUPABASE_DB_PASSWORD || secrets.SUPABASE_STAGING_DB_PASSWORD }}"), null);
});

test('required Unit Tests is an always-run fail-closed aggregate of two shards', () => {
  const source = workflow('pr-gate.yml');
  assert.match(source, /shard: \[1, 2\]/u);
  assert.match(source, /npx vitest run --shard=\$\{\{ matrix.shard \}\}\/2/u);
  assert.match(source, /unit-tests:\s+name: Unit Tests\s+needs: unit-shards\s+if: \$\{\{ always\(\) \}\}/u);
  assert.match(source, /test "\$SHARDS_RESULT" = success/u);
});
test('risk gate always runs and prerequisite failure is explicit', () => {
  const source = workflow('change-risk.yml');
  assert.match(source, /name: Publish exact-head risk verdict\s+needs: policy\s+if: \$\{\{ always\(\) && needs.policy.result != 'skipped' \}\}/u);
  assert.match(source, /checks: write/u);
  assert.ok(!source.includes('name: Change Risk Gate\n'));
  assert.ok(!source.includes('paths:'));
  assert.match(source, /test "\$POLICY_RESULT" = success/u);
  assert.match(source, /pull_request_target:/u);
  assert.match(source, /types: \[opened, synchronize, reopened, labeled, unlabeled\]/u);
  assert.match(source, /actions: read/u);
  assert.equal((source.match(/ref: \$\{\{ github.event.pull_request.base.sha \}\}/gu) ?? []).length, 2);
  assert.ok(!source.includes('ref: ${{ github.event.pull_request.head.sha }}'));
  assert.ok(!source.includes('npm ci'));
  assert.ok(!source.includes('node --test'));
  assert.ok(workflow('pr-gate.yml').includes('name: CI Policy Tests'));
});

test('approval workflows use current API labels and recheck current authorization before success', () => {
  for (const file of ['phase5a0d-intentional-redesign.yml', 'phase5a0d-renderer-attestation.yml']) {
    const source = workflow(file);
    assert.ok(!source.includes('toJSON(github.event.pull_request.labels'));
    assert.ok(source.includes('node .github/scripts/current-pr-state.mjs capture'));
    assert.ok(source.includes('node .github/scripts/current-pr-state.mjs verify'));
    assert.ok(source.includes('ref: ${{ github.event.pull_request.base.sha }}'));
    assert.ok(!source.includes('ref: ${{ github.event.pull_request.head.sha }}'));
  }
});
test('unrelated label events revalidate approval jobs without cancelling relevant runs; risk publication ignores them', () => {
  for (const file of ['change-risk.yml', 'phase5a0d-intentional-redesign.yml', 'phase5a0d-renderer-attestation.yml']) {
    const source = workflow(file);
    const labelFilter = "if: ${{ (github.event.action != 'labeled' && github.event.action != 'unlabeled') || github.event.label.name == 'phase5a0d-intentional-redesign-approved' || github.event.label.name == 'phase5a0d-renderer-attestation-approved' }}";
    assert.equal(source.includes(labelFilter), file === 'change-risk.yml');
    assert.ok(source.includes("&& 'applicable' || github.run_id }}"));
  }
});
test('only one reusable database mutation boundary exists', () => {
  const active = workflow('database-deploy-reusable.yml');
  assert.match(active, /group: database-\$\{\{ inputs.environment \}\}/u);
  assert.match(active, /cancel-in-progress: false/u);
  assert.match(active, /version: 2\.111\.0/u);
  assert.ok(!active.includes('version: latest'));
  assert.match(active, /ref: \$\{\{ github.sha \}\}/u);
  assert.match(active, /test "\$DISPATCH_SHA" = "\$REQUESTED_SHA"/u);
  assert.match(workflow('deploy.yml'), /uses: \.\/\.github\/workflows\/database-deploy-reusable.yml/u);
  assert.ok(!workflow('sync-cloud-db.yml').includes('supabase db push'));
  for (const name of readdirSync(path.join(root, '.github/workflows'))) {
    if (!name.endsWith('.yml')) continue;
    assert.ok(!workflow(name).match(/run:.*supabase db push|^\s+supabase db push/gmu), `${name} reintroduces a second raw migration deployment`);
  }
});
test('redaction is used instead of echoing matched lines', () => {
  const source = workflow('pr-gate.yml');
  assert.ok(source.includes('node scripts/ci/security-hygiene.mjs'));
  assert.ok(!source.includes('echo "$hits"'));
});
test('Lighthouse is a deliberate experiment or scheduled surveillance, never a routine PR gate', () => {
  const source = workflow('lighthouse-ci.yml');
  assert.ok(source.includes('  workflow_dispatch:'));
  assert.ok(source.includes('  schedule:'));
  assert.ok(!source.includes('  pull_request:'));
  assert.ok(!source.includes('  push:'));
  assert.ok(source.includes('Specific unresolved performance question'));
  assert.ok(source.includes('ref: ${{ env.EXPERIMENT_SOURCE_SHA }}'));
  assert.equal((source.match(/run: npm run visual-safety:lighthouse -- all/gu) ?? []).length, 2);
  assert.ok(source.includes('mobile + desktop, five runs each'));
});
test('pytest overlay preserves every production pin and executes pytest-style contracts', () => {
  const pins = (name) => new Map([...readFileSync(path.join(root, name), 'utf8').matchAll(/^([a-z0-9-]+)==([^\s;]+)/gmu)].map((match) => [match[1], match[2]]));
  const production = pins('requirements.txt');
  const overlay = pins('requirements-test.txt');
  for (const [name, version] of production) assert.equal(overlay.get(name), version, name);
  assert.equal(overlay.get('pytest'), '9.1.1');
  const qa = workflow('qa.yml');
  assert.ok(qa.includes('pip install --require-hashes -r requirements-test.txt'));
  assert.ok(qa.includes('python -m pytest pipeline test_data_quality_report.py'));
});
