/** Plan by default. Configuration writes require reviewed digest + --execute.
 * Existing staging anon key stays in process memory/child stdin only.
 * No service-role provisioning, env removal, upsert, deployment or Auth changes.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT = 'prj_FQB2vfRlaEme8EeI1AIWiscp0J09';
export const TEAM = 'team_m03pibGDg9FSJRTZGQ64NieZ';
export const SCOPE = 'erics-projects-faa226e7';
export const PRODUCTION = 'uskvezwftkkudvksmken';
export const STAGING = 'rxtaicdpnaqigowdbmsb';
export const BRANCH = 'codex/evidence-first-consumer';
export const KEYS = Object.freeze(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
const SERVICE = 'SUPABASE_SERVICE_ROLE_KEY';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export class IsolationError extends Error {}
const check = (condition, code) => { if (!condition) throw new IsolationError(code); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const targets = record => [...(record.target ?? [])].sort();
const relevant = key => /SUPABASE.*(?:URL|KEY)|NEXT_PUBLIC_SUPABASE/u.test(key);
function metadata(record) {
  return { id: record.id, key: record.key, target: targets(record), type: record.type,
    gitBranch: record.gitBranch ?? null, createdAt: record.createdAt ?? null, updatedAt: record.updatedAt ?? null,
    customEnvironmentIds: [...(record.customEnvironmentIds ?? [])].sort(), configurationId: record.configurationId ?? null };
}
export function productionFingerprint(envs) {
  return hash(JSON.stringify(envs.filter(r => relevant(r.key) && targets(r).includes('production')).map(metadata).sort((a, b) => a.id.localeCompare(b.id))));
}
export function describeValues(env) {
  const values = Object.fromEntries([...KEYS, SERVICE].map(key => [key,
    { present: !!env[key], sha256: env[key] ? hash(env[key]) : null }]));
  let projectRef = null, anonRef = null, anonRole = null;
  try { projectRef = new URL(env[KEYS[0]]).hostname.match(/^([a-z]{20})\.supabase\.co$/u)?.[1] ?? null; } catch { /* Missing stays unknown. */ }
  try { const claims = JSON.parse(Buffer.from(env[KEYS[1]].split('.')[1], 'base64url')); anonRef = claims.ref ?? null; anonRole = claims.role ?? null; } catch { /* Opaque/non-JWT keys require a separately reviewed flow. */ }
  return { projectRef, anonRef, anonRole, values };
}
export function validateStagingValues(values) {
  check(equal(Object.keys(values).sort(), [...KEYS].sort()), 'unexpected-secret-input');
  check(values[KEYS[0]] === `https://${STAGING}.supabase.co`, 'staging-url-not-canonical');
  const described = describeValues(values);
  check(described.projectRef === STAGING && described.anonRef === STAGING && described.anonRole === 'anon', 'staging-key-binding-unproven');
  return described;
}
export function inspectPreviewRecords(envs) {
  const rows = envs.filter(r => targets(r).includes('preview') && relevant(r.key));
  check(rows.every(r => KEYS.includes(r.key)), 'preview-privileged-or-alias-key-requires-review');
  check(rows.every(r => !r.gitBranch), 'branch-specific-overrides-require-review');
  check(rows.every(r => equal(targets(r), ['preview']) && !(r.customEnvironmentIds?.length)), 'shared-target-record-requires-split-review');
  check(rows.every(r => !r.configurationId), 'integration-owned-preview-record-requires-review');
  check(KEYS.every(key => rows.filter(r => r.key === key).length <= 1), 'ambiguous-preview-records');
  return rows;
}
export function makePlan(envs, production, preview, branchPreview, stagingValues) {
  const desired = validateStagingValues(stagingValues);
  const rows = inspectPreviewRecords(envs);
  check(production.projectRef === PRODUCTION && production.anonRef === PRODUCTION && production.anonRole === 'anon', 'production-baseline-unproven');
  check(!preview.values[SERVICE].present && !branchPreview.values[SERVICE].present, 'effective-preview-privileged-key-present');
  return { schemaVersion: 1, projectId: PROJECT, teamId: TEAM, target: 'preview', branchChecked: BRANCH,
    targetProjectRef: STAGING, productionMetadataSha256: productionFingerprint(envs), production,
    previewBefore: preview, branchPreviewBefore: branchPreview, requiresExclusiveEnvironmentEditWindow: true,
    serviceRoleDisposition: 'not-added; production sensitive value may be unreadable, metadata is preserved',
    operations: KEYS.map(key => {
      const record = rows.find(r => r.key === key);
      return { method: record ? 'PATCH' : 'POST', key, id: record?.id ?? null, target: ['preview'], gitBranch: null,
        type: record?.type ?? 'encrypted', beforeMetadataSha256: record ? hash(JSON.stringify(metadata(record))) : null,
        desiredValueSha256: desired.values[key].sha256 };
    }) };
}

export async function isolatePreview(transport, { execute = false, confirmedPlanSha256 } = {}) {
  const envs = await transport.inventory();
  const production = await transport.snapshot('production');
  const preview = await transport.snapshot('preview');
  const branchPreview = await transport.snapshot('preview', BRANCH);
  const values = await transport.stagingValues();
  const plan = makePlan(envs, production, preview, branchPreview, values);
  const planSha256 = hash(JSON.stringify(plan));
  if (!execute) return { result: 'PREPARED_NOT_APPLIED', planSha256, plan, configurationWrites: 0 };
  check(confirmedPlanSha256 === planSha256, 'reviewed-plan-changed');
  const verifyProduction = async () => {
    check(productionFingerprint(await transport.inventory()) === plan.productionMetadataSha256, 'production-metadata-changed');
    check(equal(await transport.snapshot('production'), production), 'production-value-fingerprints-changed');
  };
  for (const operation of plan.operations) {
    const current = await transport.inventory();
    check(productionFingerprint(current) === plan.productionMetadataSha256, 'production-metadata-changed');
    const matching = inspectPreviewRecords(current).find(r => r.key === operation.key);
    check(operation.id ? matching?.id === operation.id && hash(JSON.stringify(metadata(matching))) === operation.beforeMetadataSha256 : !matching, 'preview-record-changed');
    // PATCH only a proven Preview-only ID. Never remove/split a shared record.
    await transport.write(operation, { key: operation.key, value: values[operation.key], target: ['preview'],
      type: operation.type }); // Omit optional gitBranch; do not send a null string field.
    await verifyProduction();
  }
  const desired = validateStagingValues(values);
  const after = await transport.snapshot('preview');
  const branchAfter = await transport.snapshot('preview', BRANCH);
  for (const snapshot of [after, branchAfter]) {
    check(snapshot.projectRef === STAGING && snapshot.anonRef === STAGING && snapshot.anonRole === 'anon', 'preview-effective-binding-mismatch');
    check(KEYS.every(k => equal(snapshot.values[k], desired.values[k])) && !snapshot.values[SERVICE].present, 'preview-effective-values-mismatch');
  }
  await verifyProduction();
  return { result: 'CONFIGURED_NOT_DEPLOYED', planSha256, configurationWrites: plan.operations.length,
    productionPreserved: true, after, branchAfter, serviceRoleAdded: false,
    limitations: ['Existing deployments retain their old environment; no rebuild or auth/write test performed.',
      'No transactional API guarantee against concurrent external environment edits; an exclusive edit window is required.',
      'Sensitive production service value is not exported or claimed hash-verified when unavailable.'] };
}

export function apiInvocation(method, endpoint, body) {
  return { args: ['api', endpoint, '--method', method, '--raw', ...(body ? ['--input', '-'] : [])],
    input: body ? JSON.stringify(body) : undefined };
}
export function snapshotEnvironment(source) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !relevant(key)));
}
export function createCliTransport({ vercelCli, supabaseCli = 'supabase', cwd = process.cwd(), spawnProcess = spawnSync }) {
  check(typeof vercelCli === 'string' && vercelCli.length > 0, 'existing-vercel-cli-path-required');
  const run = (executable, args, input) => {
    const result = spawnProcess(executable, args, { cwd, env: { ...snapshotEnvironment(process.env), CI: '1' }, input,
      encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    check(!result.error && result.status === 0, 'cli-operation-failed');
    return result.stdout; // Captured only; never forward raw CLI stdout/stderr.
  };
  const vercel = (args, input) => run(process.execPath, [vercelCli, ...args, '--scope', SCOPE, '--non-interactive', '--no-color'], input);
  const api = (method, endpoint, body) => {
    const request = apiInvocation(method, endpoint, body);
    return JSON.parse(vercel(request.args, request.input));
  };
  return {
    inventory() {
      const result = api('GET', `/v9/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=false`);
      check(Array.isArray(result.envs) && !result.hiddenProductionEnvCount, 'environment-inventory-incomplete');
      return result.envs;
    },
    snapshot(environment, branch) {
      // env-run merges local .env and process values over remote records. Read
      // the exact remote records instead, so local Production defaults cannot
      // contaminate a Preview attestation. Values remain in this process only.
      const inventory = api('GET', `/v9/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=false`);
      check(Array.isArray(inventory.envs) && !inventory.hiddenProductionEnvCount, 'environment-inventory-incomplete');
      const candidates = inventory.envs.filter(r => targets(r).includes(environment) && !r.customEnvironmentIds?.length);
      if (environment === 'preview') check(!candidates.some(r => r.key === SERVICE), 'preview-privileged-key-present');
      const values = {};
      for (const key of KEYS) {
        const exact = branch ? candidates.filter(r => r.key === key && r.gitBranch === branch) : [];
        const defaults = candidates.filter(r => r.key === key && !r.gitBranch);
        check(exact.length <= 1 && defaults.length <= 1, 'ambiguous-effective-records');
        const record = exact[0] ?? defaults[0];
        if (!record) continue;
        const decrypted = api('GET', `/v1/projects/${PROJECT}/env/${record.id}?teamId=${TEAM}`);
        check(decrypted.id === record.id && decrypted.key === key && equal(targets(decrypted), targets(record)) &&
          (decrypted.gitBranch ?? null) === (record.gitBranch ?? null), 'effective-record-changed');
        check(decrypted.decrypted === true && typeof decrypted.value === 'string', 'effective-value-unreadable');
        values[key] = decrypted.value;
      }
      return describeValues(values); // Production sensitive service value is not fetched.
    },
    stagingValues() {
      const result = JSON.parse(run(supabaseCli, ['projects', 'api-keys', '--project-ref', STAGING, '--output', 'json']));
      const rows = Array.isArray(result) ? result : result.api_keys;
      const matches = rows?.filter(r => r.name === 'anon') ?? [];
      check(matches.length === 1, 'existing-staging-anon-key-missing');
      const values = { [KEYS[0]]: `https://${STAGING}.supabase.co`, [KEYS[1]]: matches[0].api_key ?? matches[0].key };
      validateStagingValues(values);
      return values;
    },
    write(operation, body) {
      check(KEYS.includes(operation.key) && equal(body.target, ['preview']) && !body.gitBranch, 'write-scope-invalid');
      if (operation.method === 'PATCH') {
        check(/^[A-Za-z0-9_-]+$/u.test(operation.id), 'record-id-invalid');
        return api('PATCH', `/v9/projects/${PROJECT}/env/${operation.id}?teamId=${TEAM}`, body);
      }
      check(operation.method === 'POST' && operation.id === null, 'write-method-invalid');
      return api('POST', `/v10/projects/${PROJECT}/env?teamId=${TEAM}`, body); // No upsert.
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  isolatePreview(createCliTransport({ vercelCli: value('--vercel-cli'), supabaseCli: value('--supabase-cli') }),
    { execute: args.includes('--execute'), confirmedPlanSha256: value('--confirm-plan-sha256') })
    .then(result => console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...result }, null, 2)))
    .catch(error => { console.error(JSON.stringify({ result: 'HOLD', code: error instanceof IsolationError ? error.message : 'isolation-operation-failed' })); process.exitCode = 1; });
}
