import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {CONSUMER_SUITES,integrationSuites,parseTap,SUITES,withLocalFixtures} from './migration-integration.mjs';
test('reviewed manifest selects its own complete contract suite',()=>{
  assert.equal(integrationSuites('docs/releases/evidence-first-foundation.migrations.json'),SUITES);
  assert.equal(integrationSuites('docs/releases/evidence-first-consumer.migrations.json'),CONSUMER_SUITES);
  assert.equal(CONSUMER_SUITES.reduce((sum,[,count])=>sum+count,0),300);
  assert.throws(()=>integrationSuites('docs/releases/other.migrations.json'));
  assert.throws(()=>integrationSuites('../evidence-first-consumer.migrations.json'));
});
test('TAP proof requires all real planned assertions, not skipped/missing/failed evidence',()=>{
  assert.equal(parseTap('ok 1 - yes\nok 2 - yes\n1..2\n',2).result,'PASS');
  for(const text of ['ok 1\n1..2\n','ok 1\nnot ok 2\n1..2\n','ok 1 # SKIP missing\nok 2\n1..2\n','ok 1\nok 2\n','ok 1\nok 2\n1..2\n1..2\n','ok 1\nok 1\n1..2\n','ok 2\nok 1\n1..2\n'])
    assert.equal(parseTap(text,2).result,'FAIL');
  assert.equal(SUITES.reduce((sum,[,count])=>sum+count,0),222);
});
test('integration is offline, original-role executed and cannot overwrite recovery receipt',()=>{
  const code=fs.readFileSync(new URL('./migration-integration.mjs',import.meta.url),'utf8');
  assert.ok(code.includes('writeReceipt:false'));
  assert.ok(code.includes('sqlAsPostgres(sql'));
  assert.ok(code.includes('role.super!==context.originalPostgresAttributes.super'));
  assert.ok(!code.includes('readPassword'));
  assert.ok(!code.includes('source-env-file'));
  assert.ok(!code.includes('CREATE USER'));
});
test('fixture adaptation does not delete or replace assertions',()=>{
  for(const [file] of [...SUITES,...CONSUMER_SUITES]) {
    const original=fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8');
    const adapted=withLocalFixtures(file,original);
    const assertions=s=>s.split(/\r?\n/).filter(line=>/^SELECT (ok|is|isnt|throws_ok|lives_ok|has_)/.test(line));
    assert.deepEqual(assertions(adapted.sql),assertions(original));
    assert.ok(adapted.sql.trim().endsWith('ROLLBACK;'));
  }
  assert.throws(()=>withLocalFixtures('evidence_first_collections.test.sql','BEGIN; ROLLBACK;'));
});
