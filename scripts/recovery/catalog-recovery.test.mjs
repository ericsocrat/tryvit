import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {TABLES,SCOPE_PROFILES,OBSERVATION_TABLES,assertEmptyObservations,scopeTables,sourceMetadata,validateScopeMetadata,privateIdentityQuery,RecoveryError,dumpArgs,externalCatalogColumn,filterToc,fingerprintQuery,identifier,readPassword,validateRestoreName} from './catalog-recovery.mjs';

test('empty observation-reference exception is exact and requires snapshot null check', () => {
  const constraint = { table: 'product_field_provenance', reference_schema: 'public',
    reference_table: 'product_source_observations', name: 'product_field_provenance_observation_id_fkey',
    definition: 'FOREIGN KEY (observation_id) REFERENCES product_source_observations(id)' };
  assert.equal(externalCatalogColumn(constraint), 'observation_id');
  for (const key of Object.keys(constraint)) {
    assert.throws(() => externalCatalogColumn({ ...constraint, [key]: 'different' }), RecoveryError);
  }
  const source = fs.readFileSync(new URL('./catalog-recovery.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('WHERE ${identifier(column)} IS NOT NULL'));
  assert.ok(source.includes('populated_external_catalog_reference_requires_scope_review'));
  assert.ok(source.indexOf('source=await sourceMetadata(session,scopeProfile)') < source.indexOf("command(bin('pg_dump')"));
});

test('versioned scopes retain the original default and explicitly include consumer registries',()=>{
  assert.equal(scopeTables(),TABLES);
  assert.equal(scopeTables('consumer-v1').length,17);
  assert.equal(SCOPE_PROFILES['observations-v1'].length,21);
  assert.equal(scopeTables('observations-v1').length,21);
  assert.throws(()=>scopeTables('unknown'),/unknown_catalog_scope_profile/);
  assert.throws(()=>fingerprintQuery('formula_source_hashes'));
  assert.match(fingerprintQuery('formula_source_hashes','consumer-v1'),/to_jsonb\(t\)/);
  assert.equal(dumpArgs('archive','snapshot','consumer-v1').filter(a=>a.startsWith('--table=')).length,17);
  const source={scopeProfile:'consumer-v1',fingerprints:Object.fromEntries(scopeTables('consumer-v1').map(t=>[t,{}]))};
  assert.equal(validateScopeMetadata(source,'consumer-v1').length,17);
  assert.throws(()=>validateScopeMetadata(source));
  for(const field of ['extra','products']) {
    const bad=structuredClone(source);
    if(field==='extra')bad.fingerprints.extra={};else delete bad.fingerprints[field];
    assert.throws(()=>validateScopeMetadata(bad,'consumer-v1'));
  }
});

test('observation scope requires all four tables empty in the export snapshot',async()=>{
  const queries=[];
  await assertEmptyObservations({query:async sql=>{queries.push(sql);return '0';}});
  assert.equal(queries.length,4);
  assert.ok(queries.every(sql=>/^SELECT count\(\*\) FROM public\./.test(sql)));
  for(let index=0;index<4;index++) {
    let call=0;
    await assert.rejects(assertEmptyObservations({query:async()=>call++===index?'1':'0'}),/populated_observation_capture_not_approved/);
  }
  for(const invalid of ['NaN','null','-1',''])await assert.rejects(assertEmptyObservations({query:async()=>invalid}));
  const source={scopeProfile:'observations-v1',observationDisposition:'empty-in-export-snapshot',
    fingerprints:Object.fromEntries(scopeTables('observations-v1').map(t=>[t,{count:0,rowSha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}]))};
  assert.equal(validateScopeMetadata(source,'observations-v1').length,21);
  for(const table of OBSERVATION_TABLES) {
    const bad=structuredClone(source);bad.fingerprints[table].count=1;
    assert.throws(()=>validateScopeMetadata(bad,'observations-v1'));
  }
  delete source.observationDisposition;
  assert.throws(()=>validateScopeMetadata(source,'observations-v1'));
});

test('consumer creator privacy gate permits exact system literals only and never selects identities',async()=>{
  const column={table:'scoring_model_versions',name:'created_by'};
  assert.equal(privateIdentityQuery(column),`SELECT count(*) FROM public."scoring_model_versions" WHERE "created_by" IS NOT NULL AND "created_by" NOT IN ('postgres','system','migration-608')`);
  assert.ok(!privateIdentityQuery({table:'products',name:'created_by'}).includes('NOT IN'));
  const tables=scopeTables('consumer-v1');
  for(const privateCount of [0,1]) {
    const queries=[];
    const session={query:async sql=>{
      queries.push(sql);
      if(sql.includes('information_schema.columns'))return JSON.stringify([...tables.map(table=>({table,name:'id'})),column]);
      if(sql.includes('FROM pg_constraint'))return '[]';
      if(sql===privateIdentityQuery(column))return String(privateCount);
      if(sql.startsWith('SELECT count(*)'))return '0';
      if(sql.includes('FROM pg_proc'))return '[]';
      return 'a'.repeat(64);
    }};
    if(privateCount)await assert.rejects(sourceMetadata(session,'consumer-v1'),/catalog_contains_private_identity_or_secret/);
    else assert.equal((await sourceMetadata(session,'consumer-v1')).scopeProfile,'consumer-v1');
    assert.ok(queries.includes(privateIdentityQuery(column)));
  }
});

test('catalog allowlist excludes customer/auth data',()=>{
  assert.equal(TABLES.length,15);
  assert.ok(TABLES.includes('products'));
  assert.ok(TABLES.every(t=>!t.startsWith('user_')&&!t.startsWith('auth.')&&!t.includes('history')));
  const args=dumpArgs('/private/catalog.dump','00000001-1');
  assert.ok(args.includes('--snapshot=00000001-1'));
  assert.ok(args.includes('--no-large-objects'));
  assert.equal(args.filter(a=>a.startsWith('--table=')).length,15);
  assert.ok(!args.some(a=>a.includes('--clean')||a.includes('--create')));
});
test('restore cannot overwrite a shared or arbitrary database',()=>{
  for(const value of ['postgres','tryvit','production','tryvit_catalog_restore_existing',"tryvit_catalog_restore_1';DROP DATABASE postgres;"])
    assert.throws(()=>validateRestoreName(value),RecoveryError);
  assert.equal(validateRestoreName('tryvit_catalog_restore_1788610000000_abcdef'),'tryvit_catalog_restore_1788610000000_abcdef');
});
test('SQL identifiers and fingerprints are allowlisted',()=>{
  assert.throws(()=>identifier('products;drop table x'));
  assert.throws(()=>fingerprintQuery('user_health_profiles'));
  assert.match(fingerprintQuery('products'),/sha256/);
  assert.match(fingerprintQuery('products'),/COLLATE "C"/);
});
test('credential input is never part of pg_dump argv',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tryvit-recovery-test-'));
  const file=path.join(directory,'.env');
  fs.writeFileSync(file,'UNRELATED=ignore\nSUPABASE_DB_PASSWORD="unit-test-canary"\n');
  assert.equal(readPassword(file,{}),'unit-test-canary');
  assert.ok(!dumpArgs('/private/backup.dump','snapshot').join(' ').includes('unit-test-canary'));
  assert.equal(readPassword(null,{SUPABASE_DB_PASSWORD:'env-canary'}),'env-canary');
  assert.throws(()=>readPassword(null,{}),/source_credential_unavailable/);
  fs.unlinkSync(file); fs.rmdirSync(directory);
});
test('restore TOC retains internal structure but not auth dependencies or executable policies',()=>{
  const input=['1; 1259 1 TABLE public products postgres','2; 0 1 TABLE DATA public products postgres',
    '3; 2606 2 CONSTRAINT public products products_pkey postgres',
    '4; 2606 3 FK CONSTRAINT public products reviewer_fk postgres',
    '5; 2620 4 TRIGGER public products unsafe_trigger postgres',
    '6; 3256 5 POLICY public products user_policy postgres',
    '7; 1259 6 INDEX public search_index postgres',
    '8; 2606 7 FK CONSTRAINT public nutrition_facts nutrition_product_fk postgres'].join('\n');
  const output=filterToc(input,['reviewer_fk']);
  assert.match(output,/TABLE DATA/);assert.match(output,/products_pkey/);assert.match(output,/nutrition_product_fk/);
  for(const value of ['reviewer_fk','unsafe_trigger','user_policy','search_index']) assert.ok(!output.includes(value));
});
