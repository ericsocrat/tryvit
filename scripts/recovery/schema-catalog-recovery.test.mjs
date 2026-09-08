import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {assertSchemaOnlyArgs,canonicalStructure,SCHEMA_QUERIES,splitBootstrapToc,syntheticRoleSql,validateCatalogReceipts} from './schema-catalog-recovery.mjs';
import {TABLES,scopeTables} from './catalog-recovery.mjs';
import {createHash} from 'node:crypto';
import {containmentArgs} from './opaque-containment.mjs';

test('fresh and legacy catalog receipts require identical complete evidence and cannot hide conflicting receipts',()=>{
  const sha='a'.repeat(64),shape=createHash('sha256').update('[]').digest('hex');
  const source={columns:[],fingerprints:Object.fromEntries(TABLES.map(n=>[n,{count:1,rowSha256:sha}]))};
  const receipt={schemaVersion:1,environment:'production',method:'backup-restore',result:'PASS',scope:'catalog-data',
    restoredAt:'2026-09-08T01:00:00Z',backupSha256:sha,restoredBackupSha256:sha,restoreDatabase:'synthetic',
    checks:Object.fromEntries(['rowCounts','identityReferences','representativeValues','archiveBytes','tableShape'].map(k=>[k,true])),
    unvalidatedStructuralConstraints:0,sourceSchemaFingerprint:shape,restoredSchemaFingerprint:shape,storageDisposition:'not-affected',
    coverage:{tables:TABLES,tableDefinitions:true,internalConstraints:true,allRowValueHashes:true,
      authRows:false,authReferences:false,rls:false,triggers:false,rpcExecution:false,storageObjects:false},
    tables:TABLES.map(name=>({name,rows:1,rowSha256:sha}))};
  assert.equal(validateCatalogReceipts([receipt],source,sha),receipt);
  assert.equal(validateCatalogReceipts([receipt,structuredClone(receipt)],source,sha),receipt);
  assert.throws(()=>validateCatalogReceipts([],source,sha));
  for(const mutate of [r=>r.result='FAIL',r=>delete r.checks.tableShape,r=>r.coverage.authRows=true,
    r=>r.tables[0].rows=2,r=>r.restoredSchemaFingerprint='b'.repeat(64),r=>r.unvalidatedStructuralConstraints=1,
    r=>r.restoredAt='2026-09-08T02:00:00Z',r=>r.restoreDatabase='different']) {
    const bad=structuredClone(receipt);mutate(bad);
    assert.throws(()=>validateCatalogReceipts([receipt,bad],source,sha));
    assert.throws(()=>validateCatalogReceipts([bad,receipt],source,sha));
  }
  assert.throws(()=>validateCatalogReceipts([receipt],source,'b'.repeat(64)));
  const tables=scopeTables('consumer-v1');
  const consumerSource={...source,scopeProfile:'consumer-v1',fingerprints:Object.fromEntries(tables.map(n=>[n,{count:1,rowSha256:sha}]))};
  const consumer={...structuredClone(receipt),schemaVersion:2,scopeProfile:'consumer-v1',
    coverage:{...receipt.coverage,tables},tables:tables.map(name=>({name,rows:1,rowSha256:sha}))};
  assert.equal(validateCatalogReceipts([consumer],consumerSource,sha,'consumer-v1'),consumer);
  assert.throws(()=>validateCatalogReceipts([consumer],consumerSource,sha));
  assert.throws(()=>validateCatalogReceipts([receipt],source,sha,'consumer-v1'));
  for(const mutate of [r=>r.schemaVersion=1,r=>delete r.scopeProfile,r=>r.scopeProfile='catalog-v1',
    r=>r.tables.pop(),r=>r.coverage.tables=[...tables,'user_preferences'],
    r=>r.tables[16].rowSha256='b'.repeat(64)]) {
    const bad=structuredClone(consumer);mutate(bad);
    assert.throws(()=>validateCatalogReceipts([bad],consumerSource,sha,'consumer-v1'));
  }
  const extraSource=structuredClone(consumerSource);extraSource.fingerprints.user_preferences={count:1,rowSha256:sha};
  assert.throws(()=>validateCatalogReceipts([consumer],extraSource,sha,'consumer-v1'));
  const all=scopeTables('observations-v1'),empty='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const emptySource={...source,scopeProfile:'observations-v1',observationDisposition:'empty-in-export-snapshot',
    fingerprints:Object.fromEntries(all.map(n=>[n,{count:0,rowSha256:empty}]))};
  const emptyReceipt={...structuredClone(receipt),schemaVersion:2,scopeProfile:'observations-v1',
    observationDisposition:'empty-in-export-snapshot',coverage:{...receipt.coverage,tables:all},
    tables:all.map(name=>({name,rows:0,rowSha256:empty}))};
  assert.equal(validateCatalogReceipts([emptyReceipt],emptySource,sha,'observations-v1'),emptyReceipt);
  delete emptyReceipt.observationDisposition;
  assert.throws(()=>validateCatalogReceipts([emptyReceipt],emptySource,sha,'observations-v1'));
});

test('production export is schema-only and cannot write plaintext or include rows',()=>{
  assert.doesNotThrow(()=>assertSchemaOnlyArgs(['--format=custom','--schema-only','--no-large-objects','--snapshot=unit']));
  for(const extra of ['--data-only','--create','--clean','--file=/private/plain.sql','--section=data','--large-objects'])
    assert.throws(()=>assertSchemaOnlyArgs(['--schema-only',extra]));
  assert.throws(()=>assertSchemaOnlyArgs(['--format=custom']));
});
test('structural proof covers code, constraints, indexes, triggers, grants and RLS',()=>{
  assert.deepEqual(Object.keys(SCHEMA_QUERIES),['schema','functions','grants','rls']);
  for(const functionName of ['pg_get_viewdef','pg_get_constraintdef','pg_get_indexdef','pg_get_triggerdef'])
    assert.ok(SCHEMA_QUERIES.schema.includes(functionName));
  assert.ok(SCHEMA_QUERIES.functions.includes('pg_get_functiondef'));
  assert.ok(SCHEMA_QUERIES.grants.includes('pg_default_acl'));
  assert.ok(SCHEMA_QUERIES.rls.includes('pg_policies'));
});
test('synthetic role boundary checks direct-access denial without production identities',()=>{
  const sql=syntheticRoleSql();
  assert.ok(sql.startsWith('BEGIN;'));
  assert.match(sql,/SET LOCAL ROLE anon/);
  assert.match(sql,/SET LOCAL ROLE authenticated/);
  assert.match(sql,/SET LOCAL ROLE service_role/);
  assert.match(sql,/insufficient_privilege/);
  assert.ok(sql.trim().endsWith('ROLLBACK;'));
  assert.ok(!sql.includes('auth.users'));
});
test('opaque recovery emits classifications, not raw errors or private SQL',()=>{
  const code=fs.readFileSync(new URL('./schema-catalog-recovery.mjs',import.meta.url),'utf8');
  assert.ok(!/console\.(log|error)\([^)]*(stderr|stdout|plain|password|roles)/.test(code));
  assert.ok(code.includes("PGSSLMODE:'verify-full'"));
  assert.ok(code.includes("default_transaction_read_only=on"));
  assert.ok(code.includes("decryptBytes(fs.readFileSync(path.join(directory,'schema.dump.enc'))"));
  assert.ok(!code.includes("--clean"+')'));
  assert.ok(code.includes("left(rolname,3)<>'pg_'"),'retain application pgbouncer role');
});
test('restore uses distinct bootstrap role and actual source locale without relaxing containment',()=>{
  const args=containmentArgs('tryvit_recovery_probe_012345abcdef',{database:true,bootstrapUser:'tryvit_recovery_operator',locale:'en_US.UTF-8'});
  assert.match(args.at(-1),/-U tryvit_recovery_operator/);
  assert.match(args.at(-1),/--locale=en_US.UTF-8/);
  assert.equal(args[args.indexOf('--network')+1],'none');
  assert.throws(()=>containmentArgs('tryvit_recovery_probe_012345abcdef',{bootstrapUser:'postgres; touch /x'}));
});
test('bootstrap splitting preserves every archive entry exactly once',()=>{
  const toc='; header\n1; 0 1 SCHEMA - public postgres\n2; 0 0 EXTENSION - pg_graphql postgres\n3; 0 1 FUNCTION public example() postgres\n4; 0 1 TABLE public products postgres\n5; 0 1 ACL public example() postgres\n';
  const split=splitBootstrapToc(toc);
  assert.ok(split.early.includes('EXTENSION - pg_graphql'));
  assert.ok(!split.remaining.includes('EXTENSION - pg_graphql'));
  for(const id of ['1;','2;','3;','4;','5;'])
    assert.equal([split.early,split.remaining].filter(s=>s.includes(id)).length,1);
  assert.throws(()=>splitBootstrapToc('; empty'));
});
test('structural normalization ignores order only, not changed index definitions',()=>{
  const before=[{name:'objects',indexes:['CREATE INDEX b','CREATE INDEX a']}];
  assert.deepEqual(canonicalStructure(before),canonicalStructure([{name:'objects',indexes:['CREATE INDEX a','CREATE INDEX b']}]));
  assert.notDeepEqual(canonicalStructure(before),canonicalStructure([{name:'objects',indexes:['CREATE INDEX a','CREATE UNIQUE INDEX b']}]));
  assert.deepEqual(before[0].indexes,['CREATE INDEX b','CREATE INDEX a']);
  const code=fs.readFileSync(new URL('./schema-catalog-recovery.mjs',import.meta.url),'utf8');
  for(const boundary of ['aclexplode','acldefault','grantor','grantee','privilege_type','is_grantable'])assert.ok(code.includes(boundary));
});
