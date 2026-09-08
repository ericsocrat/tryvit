import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const migration = read('supabase/migrations/20260908085203_evidence_compute_score_registry_correction.sql');
const suite = read('supabase/tests/evidence_compute_score_registry.test.sql');
const oldHash = 'e7b71cb1ab333a4809e4bebe8c8f654e180b824868b08f2870a168e25e13ad7c';
const newHash = '783566e4408b42edce0479c24169aa541bcdb25f4c466a8fa6d403a98b0a78e0';
const currentDefinition = read('supabase/migrations/20260315001910_scoring_v33_nutrient_density.sql').match(/CREATE OR REPLACE FUNCTION public\.compute_score\([\s\S]*?\$fn\$;/)?.[0];
const local = process.env.QA_LOCAL_POSTGRES_CONTAINER === 'supabase_db_tryvit-evidence-first';
function sql(input, error) {
  const endpoint = process.env.DOCKER_HOST || spawnSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).stdout.trim();
  assert.match(endpoint, /^(?:npipe:\/{4}\.\/pipe\/|unix:\/\/\/)/);
  assert.equal(spawnSync('docker', ['port', 'supabase_db_tryvit-evidence-first', '5432'], { encoding: 'utf8' }).stdout.trim(), '127.0.0.1:55102');
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_tryvit-evidence-first', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', timeout: 30_000 });
  if (error) { assert.equal(result.status, 3, result.stderr); assert.match(result.stderr, error); }
  else assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const stateSql = `SELECT jsonb_build_object(
 'functions',(SELECT md5(string_agg(pg_get_functiondef(p.oid)||COALESCE(p.proacl::text,''), E'\\n' ORDER BY p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
 'models',(SELECT md5(jsonb_agg(to_jsonb(m) ORDER BY version)::text) FROM public.scoring_model_versions m),
 'scores',(SELECT md5(jsonb_agg(jsonb_build_array(product_id,unhealthiness_score,score_model_version,scored_at) ORDER BY product_id)::text) FROM public.products),
 'registry_other',(SELECT md5(jsonb_agg(to_jsonb(r) ORDER BY function_name)::text) FROM public.formula_source_hashes r WHERE function_name<>'compute_score'),
 'registry',(SELECT md5(jsonb_agg(to_jsonb(r) ORDER BY function_name)::text) FROM public.formula_source_hashes r)
) state`;
const fingerprint = () => sql(stateSql + ';');

test('independent historical body hashes and mutable unique registry semantics match C7', () => {
  for (const [file, expected] of [['20260225000000_canonical_scoring_engine.sql',oldHash],['20260315001910_scoring_v33_nutrient_density.sql',newHash]]) {
    const body = read('supabase/migrations/' + file).match(/CREATE OR REPLACE FUNCTION public\.compute_score\([\s\S]*?AS \$fn\$([\s\S]*?)\$fn\$;/)?.[1];
    assert.ok(body);
    assert.equal(createHash('sha256').update(body).digest('hex'), expected);
    assert.ok(migration.includes(expected));
  }
  const registry = read('supabase/migrations/20260228000000_formula_registry.sql');
  assert.match(registry, /function_name\s+text\s+NOT NULL UNIQUE/);
  assert.match(registry, /ON CONFLICT \(function_name\) DO UPDATE\s+SET expected_hash = EXCLUDED.expected_hash,\s+updated_at\s*= now\(\)/);
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION|UPDATE public\.(?:products|scoring_model_versions)/);
});

test('C7 corrects only expected metadata, preserves evidence and has a write-free second pass', { skip: !local }, () => {
  const before = fingerprint();
  const output = sql(`BEGIN;
UPDATE public.formula_source_hashes SET expected_hash='${oldHash}',updated_at='2000-01-01' WHERE function_name='compute_score';
CREATE TEMP TABLE registry_before AS SELECT ctid::text row_location,to_jsonb(r) row_data FROM public.formula_source_hashes r WHERE function_name='compute_score';
CREATE TEMP TABLE evidence_before AS ${stateSql};
${migration}
SELECT 'corrected|' || (expected_hash='${newHash}' AND updated_at=now() AND ctid::text<>(SELECT row_location FROM registry_before)) FROM public.formula_source_hashes WHERE function_name='compute_score';
SELECT 'metadata_preserved|' || ((to_jsonb(r)-'expected_hash'-'updated_at')=(SELECT row_data-'expected_hash'-'updated_at' FROM registry_before)) FROM public.formula_source_hashes r WHERE function_name='compute_score';
CREATE TEMP TABLE evidence_after AS ${stateSql};
SELECT 'evidence_preserved|' || ((SELECT state-'registry' FROM evidence_before)=(SELECT state-'registry' FROM evidence_after));
CREATE TEMP TABLE registry_after AS SELECT ctid::text row_location,to_jsonb(r) row_data FROM public.formula_source_hashes r;
${migration}
SELECT 'second_pass_no_writes|' || NOT EXISTS(SELECT 1 FROM public.formula_source_hashes r FULL JOIN registry_after a ON a.row_data->>'function_name'=r.function_name WHERE a.row_location IS DISTINCT FROM r.ctid::text OR a.row_data IS DISTINCT FROM to_jsonb(r));
${suite.replace('BEGIN;', '')}`);
  for (const label of ['corrected','metadata_preserved','evidence_preserved','second_pass_no_writes']) assert.match(output,new RegExp('^'+label+'\\|true$','m'));
  assert.doesNotMatch(output,/^not ok /m);
  assert.equal([...output.matchAll(/^ok \d+/gm)].length,5,output);
  assert.equal(fingerprint(),before);
});

for (const [label, setup, error] of [
  ['wrong registry', "UPDATE public.formula_source_hashes SET expected_hash='unexpected' WHERE function_name='compute_score';", /registry state differs/],
  ['missing registry', "DELETE FROM public.formula_source_hashes WHERE function_name='compute_score';", /registry state differs/],
  ['unexpected body', currentDefinition.replace('AS $fn$', 'AS $fn$ '), /body differs/],
  ['overload', "CREATE FUNCTION public.compute_score(integer) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;", /requires one reviewed function/],
]) test('C7 fails closed and rolls back on '+label,{skip:!local},()=>{
  const before=fingerprint();
  sql(`BEGIN;\n${setup}\n${migration}\nROLLBACK;`,error);
  assert.equal(fingerprint(),before);
});
