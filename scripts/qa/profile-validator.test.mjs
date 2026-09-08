import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260908065059_evidence_profile_validator_bonus_types.sql'), 'utf8');
const suite = fs.readFileSync(path.join(root, 'supabase/tests/evidence_profile_validator.test.sql'), 'utf8');
const local = process.env.QA_LOCAL_POSTGRES_CONTAINER === 'supabase_db_tryvit-evidence-first';
function sql(input) {
  const endpoint = process.env.DOCKER_HOST || spawnSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).stdout.trim();
  assert.match(endpoint, /^(?:npipe:\/{4}\.\/pipe\/|unix:\/\/\/)/);
  const port = spawnSync('docker', ['port', 'supabase_db_tryvit-evidence-first', '5432'], { encoding: 'utf8' });
  assert.equal(port.stdout.trim(), '127.0.0.1:55102');
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_tryvit-evidence-first', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const fingerprint = () => sql(`
SELECT md5(string_agg(pg_get_functiondef(p.oid) || COALESCE(p.proacl::text,''), E'\n' ORDER BY p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f';
SELECT md5(jsonb_agg(to_jsonb(m) ORDER BY version)::text) FROM public.scoring_model_versions m;
`);

test('validator migration changes only validator definition', () => {
  assert.equal([...migration.matchAll(/CREATE OR REPLACE FUNCTION/g)].length, 1);
  assert.doesNotMatch(migration, /\b(?:UPDATE|INSERT|DELETE|GRANT|REVOKE)\b/);
  assert.match(suite.trim(), /ROLLBACK;$/);
});

test('local validator cases pass and all definitions ACLs and configurations survive rollback', { skip: !local }, () => {
  const before = fingerprint();
  const output = sql(`BEGIN;\n${migration}\n${suite.replace('BEGIN;', '')}`);
  assert.doesNotMatch(output, /^not ok /m);
  assert.equal([...output.matchAll(/^ok \d+/gm)].length, 39, output);
  assert.match(output, /^1\.\.39$/m);
  assert.equal(fingerprint(), before);
});

test('old bonus accounting fails the positive v3.3 regression assertion', { skip: !local }, () => {
  const historical = fs.readFileSync(path.join(root, 'supabase/migrations/20260225000000_canonical_scoring_engine.sql'), 'utf8');
  const oldValidator = historical.match(/CREATE OR REPLACE FUNCTION public\.validate_country_profile\([\s\S]*?\$fn\$;/)?.[0];
  assert.ok(oldValidator);
  const before = fingerprint();
  const output = sql(`BEGIN;\n${oldValidator}\nSELECT (public.validate_country_profile('v3.3','PL')->>'valid')::boolean;\nROLLBACK;`);
  assert.match(output, /^f$/m);
  assert.equal(fingerprint(), before);
});
