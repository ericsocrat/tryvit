import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apiInvocation, BRANCH, createCliTransport, describeValues, isolatePreview, KEYS, PRODUCTION, snapshotEnvironment, STAGING, validateStagingValues } from './preview-isolation.mjs';
const jwt = (ref, role = 'anon') => `header.${Buffer.from(JSON.stringify({ ref, role })).toString('base64url')}.synthetic-key-canary`;
const values = ref => ({ [KEYS[0]]: `https://${ref}.supabase.co`, [KEYS[1]]: jwt(ref) });
function fixture() {
  let records = [...KEYS.flatMap((key, i) => [
    { id: `prod${i}`, key, target: ['production'], type: 'encrypted', updatedAt: 1 },
    { id: `preview${i}`, key, target: ['preview'], type: 'encrypted', updatedAt: 1 },
  ]), { id: 'prodService', key: 'SUPABASE_SERVICE_ROLE_KEY', target: ['production'], type: 'sensitive', updatedAt: 1 }];
  const productionValues = values(PRODUCTION), previewValues = values(PRODUCTION);
  const writes = [];
  const transport = {
    inventory: async () => structuredClone(records),
    snapshot: async environment => describeValues(environment === 'production' ? productionValues : previewValues),
    stagingValues: async () => values(STAGING),
    write: async (operation, body) => {
      writes.push({ operation, body });
      previewValues[operation.key] = body.value;
      if (operation.id) records = records.map(r => r.id === operation.id ? { ...r, updatedAt: 2 } : r);
      else records.push({ id: `new${writes.length}`, key: body.key, target: body.target, type: body.type, updatedAt: 2 });
    },
  };
  return { transport, writes, productionValues, previewValues, get records() { return records; }, set records(v) { records = v; } };
}
test('default is read-only with exact two Preview IDs and no secret values in its plan', async () => {
  const f = fixture(), result = await isolatePreview(f.transport);
  assert.equal(result.result, 'PREPARED_NOT_APPLIED');
  assert.equal(f.writes.length, 0);
  assert.deepEqual(result.plan.operations.map(o => o.id), ['preview0', 'preview1']);
  assert.equal(result.plan.branchChecked, BRANCH);
  assert.ok(!JSON.stringify(result).includes('synthetic-key-canary'));
  assert.equal(result.plan.production.values.SUPABASE_SERVICE_ROLE_KEY.sha256, null);
});
test('reviewed execution touches only Preview records and preserves production fingerprints', async () => {
  const f = fixture(), before = structuredClone(f.records.filter(r => r.target.includes('production')));
  const plan = await isolatePreview(f.transport);
  const result = await isolatePreview(f.transport, { execute: true, confirmedPlanSha256: plan.planSha256 });
  assert.equal(result.result, 'CONFIGURED_NOT_DEPLOYED');
  assert.equal(result.productionPreserved, true);
  assert.equal(result.serviceRoleAdded, false);
  assert.equal(f.writes.length, 2);
  assert.ok(f.writes.every(w => w.operation.id.startsWith('preview') && w.body.target.length === 1 && w.body.target[0] === 'preview'));
  assert.deepEqual(f.records.filter(r => r.target.includes('production')), before);
  assert.ok(!JSON.stringify(result).includes('synthetic-key-canary'));
});
test('missing or stale approval cannot write', async () => {
  for (const confirmedPlanSha256 of [undefined, 'a'.repeat(64)]) {
    const f = fixture();
    await assert.rejects(isolatePreview(f.transport, { execute: true, confirmedPlanSha256 }), /reviewed-plan-changed/);
    assert.equal(f.writes.length, 0);
  }
});
test('shared target, branch override, integration ownership and privileged aliases require review', async () => {
  for (const modify of [
    f => { f.records.find(r => r.id === 'preview0').target.push('production'); },
    f => { f.records.find(r => r.id === 'preview0').gitBranch = BRANCH; },
    f => { f.records.find(r => r.id === 'preview0').configurationId = 'managed-integration'; },
    f => { f.records.push({ id: 'privileged', key: 'SUPABASE_SERVICE_ROLE_KEY', target: ['preview'] }); },
    f => { f.records.push({ id: 'alias', key: 'SUPABASE_URL', target: ['preview'] }); },
    f => { f.records.push({ ...f.records.find(r => r.id === 'preview0'), id: 'duplicate' }); },
  ]) {
    const f = fixture(); modify(f);
    await assert.rejects(isolatePreview(f.transport));
    assert.equal(f.writes.length, 0);
  }
});
test('missing Preview records are separate creates, never production updates or upserts', async () => {
  const f = fixture(); f.records = f.records.filter(r => !r.target.includes('preview'));
  const plan = await isolatePreview(f.transport);
  assert.ok(plan.plan.operations.every(o => o.method === 'POST' && o.id === null));
  await isolatePreview(f.transport, { execute: true, confirmedPlanSha256: plan.planSha256 });
  assert.equal(f.writes.length, 2);
  assert.ok(f.writes.every(w => w.operation.method === 'POST' && w.body.target[0] === 'preview'));
});
test('rechecks scope immediately before writing and refuses a concurrent shared-record change', async () => {
  const f = fixture(), plan = await isolatePreview(f.transport);
  let reads = 0;
  f.transport.inventory = async () => {
    if (++reads === 2) f.records.find(r => r.id === 'preview0').target.push('production');
    return structuredClone(f.records);
  };
  await assert.rejects(isolatePreview(f.transport, { execute: true, confirmedPlanSha256: plan.planSha256 }));
  assert.equal(f.writes.length, 0);
});
test('stops after production drift rather than claiming success or making compensating writes', async () => {
  const f = fixture(), plan = await isolatePreview(f.transport), originalWrite = f.transport.write;
  f.transport.write = async (...args) => { await originalWrite(...args); f.productionValues[KEYS[1]] += 'changed'; };
  await assert.rejects(isolatePreview(f.transport, { execute: true, confirmedPlanSha256: plan.planSha256 }), /production-value-fingerprints-changed/);
  assert.equal(f.writes.length, 1);
});
test('never places credential payloads in process arguments', () => {
  const request = apiInvocation('PATCH', '/v9/projects/project/env/preview', { value: 'synthetic-secret', target: ['preview'] });
  assert.ok(request.input.includes('synthetic-secret'));
  assert.ok(!request.args.join(' ').includes('synthetic-secret'));
  assert.deepEqual(request.args.slice(-2), ['--input', '-']);
});
test('only canonical staging URL and an existing staging anon-role key are eligible', () => {
  assert.doesNotThrow(() => validateStagingValues(values(STAGING)));
  for (const wrong of [values(PRODUCTION), { ...values(STAGING), [KEYS[0]]: `http://${STAGING}.supabase.co` },
    { ...values(STAGING), [KEYS[1]]: jwt(STAGING, 'service_role') }, { ...values(STAGING), SUPABASE_SERVICE_ROLE_KEY: 'not-permitted' }]) {
    assert.throws(() => validateStagingValues(wrong));
  }
});

test('remote record snapshots cannot be contaminated by local dotenv or inherited Production values', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'tryvit-preview-snapshot-test-'));
  const previous = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  const calls = [];
  const remote = values(STAGING), local = values(PRODUCTION);
  const records = KEYS.map((key, i) => ({ id: `remote${i}`, key, target: ['preview'], type: 'encrypted' }));
  try {
    writeFileSync(path.join(cwd, '.env'), KEYS.map(k => `${k}=${local[k]}`).join('\n'));
    Object.assign(process.env, local);
    // This is the installed CLI59.7 env-run precedence that caused the false HOLD.
    assert.equal(describeValues({ ...remote, ...local, ...process.env }).projectRef, PRODUCTION);
    const transport = createCliTransport({ cwd, vercelCli: 'synthetic-cli.js', spawnProcess: (_exe, args, options) => {
      calls.push(args);
      assert.ok(KEYS.every(k => !Object.hasOwn(options.env, k)));
      assert.ok(!args.includes('run'));
      const endpoint = args[args.indexOf('api') + 1];
      if (endpoint.startsWith('/v9/')) return { status: 0, stdout: JSON.stringify({ envs: records }), stderr: '' };
      const record = records.find(r => endpoint.includes(`/env/${r.id}?`));
      return { status: 0, stdout: JSON.stringify({ ...record, decrypted: true, value: remote[record.key] }), stderr: '' };
    } });
    const snapshot = transport.snapshot('preview', BRANCH);
    assert.equal(snapshot.projectRef, STAGING);
    assert.equal(snapshot.anonRef, STAGING);
    assert.equal(calls.length, 3);
    assert.ok(calls.every(args => args[args.indexOf('--method') + 1] === 'GET'));
  } finally {
    for (const key of KEYS) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('snapshot child environment strips runtime Supabase keys but preserves CLI authentication', () => {
  const env = snapshotEnvironment({ NEXT_PUBLIC_SUPABASE_URL: 'local', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local',
    SUPABASE_SERVICE_ROLE_KEY: 'local', SUPABASE_URL: 'alias', SUPABASE_ACCESS_TOKEN: 'management', VERCEL_TOKEN: 'existing-auth', PATH: 'path' });
  assert.deepEqual(env, { SUPABASE_ACCESS_TOKEN: 'management', VERCEL_TOKEN: 'existing-auth', PATH: 'path' });
});
