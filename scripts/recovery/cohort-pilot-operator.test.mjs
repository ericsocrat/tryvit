import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {syntheticPilot} from './cohort-synthetic-fixture.mjs';
import {scopeTables} from './catalog-recovery.mjs';
import {SCHEMA_QUERIES} from './schema-catalog-recovery.mjs';
import {hash} from '../ci/database-release.mjs';
import {ingestionInputs,applyInSession,rollbackInSession,snapshotSql,validateBefore,validateAfter,validateReversal,
  reversalSql,validateCombinedProof,inspectOutcome,canonicalDecimal,timestampMicros,revisionNumber} from './cohort-pilot-operator.mjs';

function fixture() {
  const {pilot}=syntheticPilot(),[,record]=ingestionInputs(pilot.sql.mutation);
  const before={product:{product_id:178,country:'PL',ean:'5900340003615',brand:record.identity.brand,
    product_name:record.identity.product_name,category:record.identity.category,is_deprecated:false,updated_at:'before'},
    nutrition:{product_id:178,calories:'219.0',trans_fat_g:'0',fibre_g:'0',updated_at:'before'},provenance:[],source:null,assertions:[],observations:[],
    sourceCounts:[0,0,0,0],identityIds:[178],competingNames:[],unaffected:{products:'fixed',product_ingredient:'fixed',product_allergen_info:'fixed'},
    model:{evidence:{state:'legacy_unverified'},sources:[]}};
  const after=structuredClone(before);
  after.product.updated_at='after';after.nutrition.updated_at='after';
  Object.assign(after.nutrition,{calories:'219',total_fat_g:'1.8',saturated_fat_g:'0.3',trans_fat_g:null,carbs_g:'44',
    sugars_g:'1.6',fibre_g:null,protein_g:'4.8',salt_g:'1.4'});
  after.observations=[{id:'11111111-1111-4111-8111-111111111111',payload_hash:record.payload_hash,status:'accepted',
    retrieved_at:record.retrieved_at,source_updated_at:record.source_updated_at,source_revision:String(record.source_revision),row_sha256:'b'.repeat(64)}];
  after.source={id:'22222222-2222-4222-8222-222222222222',product_id:178,source_key:'off_api',selected_observation_id:after.observations[0].id};
  after.sourceCounts=[1,1,1,0];
  after.provenance=Object.entries(record.extracted_fields).map(([field_name,v])=>({field_name,observation_id:after.observations[0].id,evidence_state:v.state,basis:v.basis??'unknown'}));
  after.model={evidence:{state:'recorded'},sources:[after.observations[0]]};
  const fingerprints=Object.fromEntries(scopeTables('observations-v1').map(t=>[t,{count:0,rowSha256:'a'.repeat(64)}]));
  return {before,after,record,plan:{pilot,planSha256:'c'.repeat(64),proof:{metadata:{fingerprints},
    sourceFingerprints:Object.fromEntries(['schema','functions','rls'].map(k=>[k,hash(Buffer.from('[]'))]))}}};
}

test('legacy execution rejects before reading retained artifacts or credentials',()=>{
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./cohort-pilot-operator.mjs',import.meta.url)),'--execute'],
    {encoding:'utf8',cwd:process.env.TEMP??process.cwd(),env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot}});
  assert.equal(result.status,1);assert.equal(result.stdout,'');
  assert.equal(JSON.parse(result.stderr).code,'operator_use_versioned_production_wrapper');
});

test('durable nutrient snapshots preserve scale and comparisons never round through JavaScript Number',()=>{
  const {before,after}=fixture();
  assert.match(snapshotSql,/calories::text/);
  assert.ok(reversalSql(before,after).includes('"calories":"219.0"'));
  assert.equal(canonicalDecimal('219.0'),canonicalDecimal('2.19e2'));
  assert.equal(canonicalDecimal('-0.000'),canonicalDecimal('0'));
  assert.notEqual(canonicalDecimal('1.8000000000000000001'),canonicalDecimal('1.8'));
});

test('fresh snapshot enforces immutable identity, missing sets, no newer evidence and exact unaffected rows',()=>{
  const {before,after,record}=fixture();
  validateBefore(before,record);validateAfter(before,after,record);
  for(const mutate of [x=>x.identityIds.push(99),x=>x.competingNames.push(99),x=>x.sourceCounts[0]=1,
    x=>x.product.product_name='unreviewed rename',x=>x.product.last_fetched_at='2099-01-01T00:00:00Z']) {
    const bad=structuredClone(before);mutate(bad);assert.throws(()=>validateBefore(bad,record));
  }
  for(const mutate of [x=>x.unaffected.product_ingredient='changed',x=>x.nutrition.calories=220,
    x=>x.provenance[0].basis='per_100ml',x=>x.observations[0].retrieved_at='2099-01-01T00:00:00Z',
    x=>x.source.selected_observation_id=null]) {
    const bad=structuredClone(after);mutate(bad);assert.throws(()=>validateAfter(before,bad,record));
  }
});

test('malformed timestamps cannot bypass preflight through NaN comparisons',()=>{
  const {before,record}=fixture();
  for(const value of ['not-a-date','2026-02-30T00:00:00Z','2026-09-05','',42]) {
    const bad=structuredClone(before);bad.product.last_fetched_at=value;
    assert.throws(()=>validateBefore(bad,record));
    assert.throws(()=>validateBefore(before,{...record,retrieved_at:value}));
    assert.throws(()=>validateBefore(before,{...record,source_updated_at:value}));
  }
});

test('revision ordering is numeric for string revisions',()=>{
  const {before,record}=fixture();
  before.product.off_revision='9';
  assert.doesNotThrow(()=>validateBefore(before,{...record,source_revision:'10'}));
  before.product.off_revision='10';
  assert.throws(()=>validateBefore(before,{...record,source_revision:'9'}));
  before.product.off_revision='9007199254740993';
  assert.doesNotThrow(()=>validateBefore(before,{...record,source_revision:'9007199254740994'}));
  assert.throws(()=>validateBefore(before,{...record,source_revision:'9007199254740992'}));
  for(const invalid of ['',false,'-1','0','1.5','1e2','NaN',9007199254740992,'9223372036854775808'])assert.throws(()=>revisionNumber(invalid));
});

test('timestamps validate calendar/offset and preserve microsecond ordering',()=>{
  assert.equal(timestampMicros('2026-09-05T12:27:34.904106+02:00'),timestampMicros('2026-09-05T10:27:34.904106Z'));
  assert.ok(timestampMicros('2026-09-05T10:27:34.904107Z')>timestampMicros('2026-09-05T10:27:34.904106Z'));
  for(const invalid of ['2026-13-01T00:00:00Z','2026-01-00T00:00:00Z','2026-01-01T24:00:00Z',
    '2026-01-01T00:00:00+02:60','2026-01-01T00:00:00.1234567Z',null])assert.throws(()=>timestampMicros(invalid));
  const {before,record,after}=fixture();
  before.product.last_fetched_at='2026-09-05T10:27:34.904107Z';
  assert.throws(()=>validateBefore(before,record),/newer_projection/);
  delete before.product.last_fetched_at;
  assert.throws(()=>validateBefore(before,{...record,source_updated_at:'2026-09-06T00:00:00Z'}),/after_retrieval/);
  after.observations[0].source_revision=String(BigInt(record.source_revision)+1n);
  assert.throws(()=>validateAfter(before,after,record));
});

test('durable encrypted snapshots precede ingestion and commit; persistence failure prevents ingestion',async()=>{
  const {before,after,plan}=fixture(),events=[];
  let snapshots=0;
  const session={query:async sql=>{
    if(Object.values(SCHEMA_QUERIES).includes(sql))return '[]';
    if(sql===snapshotSql)return JSON.stringify(snapshots++?after:before);
    if(sql.includes('public.ingestion_apply_observation')){events.push('ingest');return JSON.stringify({status:'accepted',product_id:178,observation_id:after.observations[0].id});}
    if(sql.includes("'rowSha256'"))return JSON.stringify({count:0,rowSha256:'a'.repeat(64)});
    events.push(sql);return '';
  }};
  const store={save:stage=>{events.push('persist-'+stage);return 'd'.repeat(64);}};
  assert.equal((await applyInSession(session,plan,store)).result,'APPLIED');
  assert.ok(events.indexOf('persist-before')<events.indexOf('ingest'));
  assert.ok(events.indexOf('persist-after')<events.indexOf('COMMIT'));
  snapshots=0;events.length=0;
  await assert.rejects(applyInSession(session,plan,{save:()=>{throw Error('disk unavailable');}}));
  assert.ok(!events.includes('ingest'));assert.equal(events.at(-1),'ROLLBACK');
});

test('stale backup fails before durable preimage or ingestion',async()=>{
  const {plan}=fixture();let saved=false;
  await assert.rejects(applyInSession({query:async sql=>Object.values(SCHEMA_QUERIES).includes(sql)?'[]':sql.includes("'rowSha256'")?JSON.stringify({count:999,rowSha256:'x'}):''},
    plan,{save:()=>{saved=true;}}),/operator_catalog_changed_since_backup/);
  assert.equal(saved,false);
});

test('uncertain commit is classified without an automatic retry',async()=>{
  const {before,after,plan}=fixture();let snapshots=0,ingestions=0;
  const session={query:async sql=>{
    if(Object.values(SCHEMA_QUERIES).includes(sql))return '[]';
    if(sql===snapshotSql)return JSON.stringify(snapshots++?after:before);
    if(sql.includes('public.ingestion_apply_observation')){ingestions++;return JSON.stringify({status:'accepted',product_id:178});}
    if(sql.includes("'rowSha256'"))return JSON.stringify({count:0,rowSha256:'a'.repeat(64)});
    if(sql==='COMMIT')throw Error('connection lost');return '';
  }};
  await assert.rejects(applyInSession(session,plan,{save:()=>''}),/commit_outcome_uncertain/);assert.equal(ingestions,1);
});

test('rollback compares the complete postimage and never deletes immutable observations',async()=>{
  const {before,after}=fixture();
  const restored=structuredClone(before);restored.source={...after.source,selected_observation_id:null};restored.observations=after.observations;
  restored.sourceCounts=after.sourceCounts;
  restored.product.updated_at='rollback';restored.nutrition.updated_at='rollback';
  validateReversal(before,after,restored);
  assert.equal(inspectOutcome({before,after},before),'NOT_APPLIED_MATCHING_PREIMAGE');
  assert.equal(inspectOutcome({before,after},after),'APPLIED_MATCHING_POSTIMAGE');
  assert.equal(inspectOutcome({before,after},restored),'REVERSED_MATCHING_BASELINE');
  const sql=reversalSql(before,after);
  assert.ok(!/DELETE FROM public\.(product_source_observations|product_source_records|ingestion_batches)/.test(sql));
  let snapshots=0;
  const result=await rollbackInSession({query:async s=>s===snapshotSql?JSON.stringify(snapshots++?restored:after):''},{before,after},()=> 'proof');
  assert.equal(result.result,'REVERSED');
  const drift=structuredClone(after);drift.product.brand='concurrent edit';
  assert.equal(inspectOutcome({before,after},drift),'DRIFT_REQUIRES_REVIEW');
  await assert.rejects(rollbackInSession({query:async s=>s===snapshotSql?JSON.stringify(drift):''},{before,after},()=>''),/refuses_concurrent_change/);
});

test('consumer17 and failed/incomplete receipts never authorize the21 operator',()=>{
  for(const receipt of [{schemaVersion:1},{schemaVersion:2,scopeProfile:'consumer-v1'},
    {schemaVersion:2,scopeProfile:'observations-v1',scope:'schema-and-catalog',result:'FAIL'}])
    assert.throws(()=>validateCombinedProof(receipt,{fingerprints:{}},'a','b'),/exact_restored_empty21/);
});
