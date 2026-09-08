import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const counts = { api_surfaces: 18, view_consistency: 16, country_isolation: 11,
  diet_filtering: 6, allergen_filtering: 6, barcode_lookup: 9, allergen_evidence_semantics: 7 };
const read = (suite) => fs.readFileSync(path.join(root, `db/qa/QA__${suite}.sql`), 'utf8');

test('consumer QA preserves the full 73-check inventory and transaction boundaries', () => {
  for (const [suite, count] of Object.entries(counts)) {
    const sql = read(suite);
    assert.equal([...sql.matchAll(/AS check_name/g)].length, count, suite);
    assert.match(sql, /BEGIN;/);
    assert.match(sql.trim(), /ROLLBACK;$/);
    assert.doesNotMatch(sql, /set_config\([^;]+,\s*false\)/);
    assert.doesNotMatch(sql, /DELETE FROM (?:auth\.users|user_preferences|user_product_lists)/);
    assert.match(sql, /condition IS TRUE THEN 0 ELSE 1/);
  }
});

const local = process.env.QA_LOCAL_POSTGRES_CONTAINER === 'supabase_db_tryvit-evidence-first';
function sql(command) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_tryvit-evidence-first',
    'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|'],
  { input: command, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('actual local QA rejects an empty canonical success payload and rolls back the stub', { skip: !local }, () => {
  const fingerprint = () => sql("SELECT md5(pg_get_functiondef('public.api_find_products(text,jsonb,integer,integer,boolean,text)'::regprocedure));").trim();
  const before = fingerprint();
  const original = read('api_surfaces');
  const marker = 'CREATE TEMP TABLE qa_find AS';
  assert.ok(original.includes(marker));
  const stub = `CREATE OR REPLACE FUNCTION public.api_find_products(p_query text DEFAULT NULL,p_filters jsonb DEFAULT '{}'::jsonb,p_page integer DEFAULT 1,p_page_size integer DEFAULT 20,p_show_avoided boolean DEFAULT false,p_language text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$ SELECT '{}'::jsonb; $$;
`;
  const output = sql(original.replace(marker, () => stub + marker));
  assert.match(output, /15\. canonical search returns the controlled fixture and pagination\|1/);
  assert.match(output, /16\. canonical search preserves requested country\|1/);
  assert.equal(fingerprint(), before);
});

test('actual local QA rejects a NULL retirement payload', { skip: !local }, () => {
  const original = read('api_surfaces');
  const marker = "SELECT '1. retired detail requires refresh'";
  assert.ok(original.includes(marker));
  const stub = `CREATE OR REPLACE FUNCTION pg_temp.qa_retired(payload jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT NULL::boolean; $$;
`;
  const output = sql(original.replace(marker, () => stub + marker));
  assert.match(output, /1\. retired detail requires refresh\|1/);
  assert.match(output, /17\. retired list API cannot return nullable score rows\|1/);
});
