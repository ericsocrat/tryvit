import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (suite) => fs.readFileSync(path.join(root, `db/qa/QA__${suite}.sql`), 'utf8');
const local = process.env.QA_LOCAL_POSTGRES_CONTAINER === 'supabase_db_tryvit-evidence-first';
function query(input) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_tryvit-evidence-first', 'psql', '-X',
    '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|'],
  { input, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const checks = (output) => output.split(/\r?\n/).filter((line) => /^\d+\..*\|\d+$/.test(line));

test('archive and scanner QA retain all 29 checks', () => {
  assert.equal([...read('health_profiles').matchAll(/AS check_name/g)].length, 14);
  assert.equal([...read('scanner_submissions').matchAll(/AS check_name/g)].length, 15);
});

test('current local archive CRUD, RLS and scanner contracts pass', { skip: !local }, () => {
  const results = checks(query(`BEGIN;\n${read('health_profiles')}\n${read('scanner_submissions')}\nROLLBACK;`));
  assert.equal(results.length, 29);
  assert.deepEqual(results.filter((line) => !line.endsWith('|0')), []);
});

test('QA detects a retired warning shim becoming privileged and restores its definition', { skip: !local }, () => {
  const fingerprint = () => query("SELECT md5(pg_get_functiondef('public.api_product_health_warnings(bigint,uuid)'::regprocedure));").trim();
  const before = fingerprint();
  const output = query(`BEGIN; ALTER FUNCTION public.api_product_health_warnings(bigint,uuid) SECURITY DEFINER;\n${read('health_profiles')}\nROLLBACK;`);
  assert.match(output, /7\. owner CRUD stays privileged and retired warnings are refresh-only\|[1-9]/);
  assert.equal(fingerprint(), before);
});

test('QA rejects old scanner success payloads containing nullable grades', { skip: !local }, () => {
  const fingerprint = () => query("SELECT md5(pg_get_functiondef('public.api_get_scan_history(integer,integer,text)'::regprocedure));").trim();
  const before = fingerprint();
  const output = query(`BEGIN;
CREATE OR REPLACE FUNCTION public.api_get_scan_history(p_page integer DEFAULT 1,p_page_size integer DEFAULT 20,p_filter text DEFAULT 'all')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT '{"scans":[{"unhealthiness_score":null}]}'::jsonb; $$;
${read('scanner_submissions')}
ROLLBACK;`);
  assert.match(output, /2\. v2 scanner and submission security with fail-closed legacy shims\|[1-9]/);
  assert.equal(fingerprint(), before);
});
