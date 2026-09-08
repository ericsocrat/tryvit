import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=file=>readFileSync(path.join(root,file),'utf8');

test('CI enables real pg_stat_statements before all twelve slow-query assertions',()=>{
  const workflow=read('.github/workflows/qa.yml');
  const preload=workflow.indexOf("ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'");
  const restart=workflow.indexOf('docker restart "$POSTGRES_CONTAINER"');
  const migrations=workflow.indexOf('- name: Apply schema migrations');
  assert.ok(preload>0 && restart>preload && migrations>restart);
  assert.match(workflow,/POSTGRES_CONTAINER: \$\{\{ job.services.postgres.id \}\}/);
  assert.match(workflow,/SHOW shared_preload_libraries/);
  const suite=read('db/qa/QA__slow_queries.sql');
  assert.equal([...suite.matchAll(/AS check_name/g)].length,12);
  assert.match(suite,/COUNT\(\*\) >= 0 FROM report_slow_queries\(0\)/);
});

test('historical dispersion remains twelve visible diagnostics and errors stay blocking',()=>{
  const suite=read('db/qa/QA__scoring_distribution.sql');
  assert.equal([...suite.matchAll(/AS issue/g)].length,12);
  const runner=read('RUN_QA.ps1');
  assert.match(runner,/Id = "scoring_distribution"; Checks = 12; Blocking = \$false/);
  assert.match(runner,/historical_score_diagnostic/);
  assert.match(runner,/summary.execution_errors -gt 0/);
  assert.match(runner,/consumer_retirement.status -ne 'pass'/);
  const ids=new Set([...runner.matchAll(/Id = "([^"]+)"/g)].map(match=>match[1]));
  const required=read('scripts/qa/qa-result-accounting.ps1').match(/\$required = @\(([^\n]+)\)/)[1];
  for(const match of required.matchAll(/'([^']+)'/g)) assert.ok(ids.has(match[1]),`unknown required suite ${match[1]}`);
  assert.match(read('.github/workflows/qa.yml'),/execution errors; \$\(\$qa.summary.untested\) untested checks/);
});

test('CI historical scoring dispatches every active market/category once with unchanged statement limits',()=>{
  const sql=read('db/ci_post_enrichment.sql');
  assert.match(sql,/SELECT format\('CALL public\.score_category\(%L, 100, %L\);', category, country\)/);
  assert.match(sql,/SELECT DISTINCT country, category FROM public\.products\s+WHERE is_deprecated IS NOT TRUE/);
  assert.match(sql,/ORDER BY country, category\s+\\gexec/);
  assert.equal((sql.match(/CALL public\.score_category/g)??[]).length,1);
  assert.doesNotMatch(sql,/DO \$reconcile_scores\$|CALL score_category\(|SET\s+(?:LOCAL\s+)?statement_timeout/i);
  assert.ok(sql.indexOf('\\gexec')<sql.indexOf('COMMIT;'));
});
