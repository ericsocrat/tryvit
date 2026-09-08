import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (name) => fs.readFileSync(path.join(root, `db/qa/QA__${name}.sql`), 'utf8');
const local = process.env.QA_LOCAL_POSTGRES_CONTAINER === 'supabase_db_tryvit-evidence-first';
function sql(input) {
  const endpoint = process.env.DOCKER_HOST || spawnSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).stdout.trim();
  assert.match(endpoint, /^(?:npipe:\/{4}\.\/pipe\/|unix:\/\/\/)/);
  const port = spawnSync('docker', ['port', 'supabase_db_tryvit-evidence-first', '5432'], { encoding: 'utf8' });
  assert.equal(port.stdout.trim(), '127.0.0.1:55102');
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_tryvit-evidence-first', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|'], { input, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout + '\n' + result.stderr;
}

test('current contract fixtures cannot write an existing product or fixed user', () => {
  for (const name of ['auth_onboarding', 'performance_regression', 'data_provenance', 'api_contract']) {
    const source = read(name);
    assert.match(source, /BEGIN;/);
    assert.match(source.trim(), /ROLLBACK;$/);
    assert.doesNotMatch(source, /SELECT product_id INTO v_pid FROM products LIMIT 1/);
    assert.doesNotMatch(source, /00000000-0000-0000-0000-000000000077/);
  }
  assert.doesNotMatch(read('explain_analysis'), /FROM servings|JOIN servings/);
});

test('provenance QA leaves all existing provenance rows unchanged', { skip: !local }, () => {
  const fingerprint = () => sql("SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY product_id,field_name)::text,'')) FROM public.product_field_provenance p;").trim();
  const before = fingerprint();
  const result = sql(read('data_provenance'));
  assert.equal([...result.matchAll(/T\d+ PASS/g)].length, 28);
  assert.equal(fingerprint(), before);
});

test('canonical API QA detects a numeric aggregate injected into its temporary model', { skip: !local }, () => {
  const source = read('api_contract');
  const marker = "SELECT '13. canonical envelope keys'";
  assert.ok(source.includes(marker));
  const output = sql(source.replace(marker, () => "UPDATE qa_contract_model SET m=jsonb_set(m,'{score,value}','100'::jsonb);\n" + marker));
  assert.match(output, /28\. retirement marker cannot contain a score\|1/);
});

test('fast error responses cannot pass canonical performance smoke checks', { skip: !local }, () => {
  const source = read('performance_regression');
  const marker = "SELECT '1. canonical search completes";
  assert.ok(source.includes(marker));
  const output = sql(source.replace(marker, () => "UPDATE qa_timings SET payload='{}'::jsonb;\n" + marker));
  assert.equal([...output.matchAll(/^\d+\..*\|1$/gm)].length, 6);
});
