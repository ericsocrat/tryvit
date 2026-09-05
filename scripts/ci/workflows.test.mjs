import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = (name) => readFileSync(path.join(root, '.github/workflows', name), 'utf8');

test('required Unit Tests is an always-run fail-closed aggregate of two shards', () => {
  const source = workflow('pr-gate.yml');
  assert.match(source, /shard: \[1, 2\]/u);
  assert.match(source, /npx vitest run --shard=\$\{\{ matrix.shard \}\}\/2/u);
  assert.match(source, /unit-tests:\s+name: Unit Tests\s+needs: unit-shards\s+if: \$\{\{ always\(\) \}\}/u);
  assert.match(source, /test "\$SHARDS_RESULT" = success/u);
});
test('risk gate always runs and prerequisite failure is explicit', () => {
  const source = workflow('change-risk.yml');
  assert.match(source, /name: Publish exact-head risk verdict\s+needs: policy\s+if: \$\{\{ always\(\) \}\}/u);
  assert.match(source, /checks: write/u);
  assert.ok(!source.includes('name: Change Risk Gate\n'));
  assert.ok(!source.includes('paths:'));
  assert.match(source, /test "\$POLICY_RESULT" = success/u);
  assert.match(source, /pull_request_target:/u);
  assert.equal((source.match(/ref: \$\{\{ github.event.pull_request.base.sha \}\}/gu) ?? []).length, 2);
  assert.ok(!source.includes('ref: ${{ github.event.pull_request.head.sha }}'));
  assert.ok(!source.includes('npm ci'));
  assert.ok(!source.includes('node --test'));
  assert.ok(workflow('pr-gate.yml').includes('name: CI Policy Tests'));
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
