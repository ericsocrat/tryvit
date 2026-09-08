import assert from 'node:assert/strict';
import test from 'node:test';
import {remainingManifest as makeManifest,reviewSelection as select,retainedEntries as readEntries,batchFor,snapshotSql,rollbackSql,rollbackOne,applyOne,verifyBatchPostimages,targetSnapshot,checkBefore,checkAssertions,digest,NUTRIENTS} from './cohort-batch.mjs';
import {proposedPublicAllowlist as propose,validatePublicAllowlist as validate,approvedSnapshotDumpArgs as dumpArgs} from './cohort-public-recovery.mjs';
import {syntheticRetainedSource} from './cohort-synthetic-fixture.mjs';
import {hash} from '../ci/database-release.mjs';
const source=syntheticRetainedSource(),input={retainedSource:source};
const remainingManifest=()=>makeManifest(source),retainedEntries=()=>readEntries(source);
const reviewSelection=(manifest,ids,sha)=>select(manifest,ids,sha,source);
const proposedPublicAllowlist=rows=>propose(rows,input);
const validatePublicAllowlist=(rows,manifest,sha)=>validate(rows,manifest,sha,input);
const approvedSnapshotDumpArgs=(session,options)=>dumpArgs(session,{...options,input});

test('synthetic retained input still checks plan, record, receipt and canonical payload hashes',()=>{
  assert.equal(readEntries(syntheticRetainedSource()).length,60);
  assert.throws(()=>readEntries({...syntheticRetainedSource(),planSha256:'0'.repeat(64)}),/original_plan_changed/);
  const bad=syntheticRetainedSource();bad.files.set('audit-reports/evidence-cohort/run-20260905T101700Z/synthetic-148.json',Buffer.from('{}'));
  assert.throws(()=>readEntries(bad),/record_hash_changed/);
  const receiptKey='audit-reports/evidence-cohort/run-20260905T101700Z/receipt.json';
  const receiptBad=syntheticRetainedSource(),receipt=JSON.parse(receiptBad.files.get(receiptKey));
  receipt.members[0].observation_sha256='0'.repeat(64);receiptBad.files.set(receiptKey,Buffer.from(JSON.stringify(receipt)));
  assert.throws(()=>readEntries(receiptBad),/receipt_binding_changed/);
  const payloadBad=syntheticRetainedSource(),recordKey='audit-reports/evidence-cohort/run-20260905T101700Z/synthetic-178.json';
  const record=JSON.parse(payloadBad.files.get(recordKey));record.payload_canonical='{}';
  const bytes=Buffer.from(JSON.stringify(record));payloadBad.files.set(recordKey,bytes);
  const payloadReceipt=JSON.parse(payloadBad.files.get(receiptKey));payloadReceipt.members[0].observation_sha256=hash(bytes);
  payloadBad.files.set(receiptKey,Buffer.from(JSON.stringify(payloadReceipt)));
  const planKey='audit-reports/evidence-cohort/production-import-plan-20260908/plan.json';
  const plan=JSON.parse(payloadBad.files.get(planKey));plan.members[0].record_sha256=hash(bytes);
  const planBytes=Buffer.from(JSON.stringify(plan));payloadBad.files.set(planKey,planBytes);payloadBad.planSha256=hash(planBytes);
  assert.throws(()=>readEntries(payloadBad),/payload_hash_changed/);
});

test('retained manifest contains exactly35 unchanged plus19 reviewed renames and excludes pilot/held5',()=>{
  const m=remainingManifest();
  assert.equal(m.entries.length,54);assert.equal(m.entries.filter(e=>e.decision==='unchanged-candidate').length,35);
  assert.equal(m.entries.filter(e=>e.decision!=='unchanged-candidate').length,19);
  assert.deepEqual(m.held.map(e=>e.productId).sort((a,b)=>a-b),[628,2882,2903,2950,6029]);
  assert.equal(m.liveProductionChecked,false);assert.equal(m.reviewStatus,'pending-root-review');
  assert.ok(m.entries.every(e=>e.productId!==178));
  for(const ids of [[178],[628],[],m.entries.slice(0,6).map(e=>e.productId),[148,148]])assert.throws(()=>reviewSelection(m,ids,m.sha256));
  assert.throws(()=>reviewSelection(m,[148],'wrong'));
  const entries=reviewSelection(m,[148,195],m.sha256);assert.equal(entries.length,2);
  for(const entry of entries) {
    assert.deepEqual(entry.batchScope.map(e=>e.productId).sort((a,b)=>a-b),[148,195]);
    assert.ok(snapshotSql(entry).includes(`product_id NOT IN (${entry.productId})`));
    assert.ok(!snapshotSql(entry).includes('product_id NOT IN (148,195)'));
  }
});

test('reviewed rename preserves identity and changed preimages/competing identities fail closed',()=>{
  const e=retainedEntries().find(e=>e.productId===148);
  const before={product:{product_id:148,country:e.country,ean:e.externalId,is_deprecated:false,...e.beforeAttributes},nutrition:{},
    identityIds:[148],competingNames:[],observations:[],source:null,provenance:[],assertions:[]};
  assert.equal(checkBefore(e,before),'apply');
  const changed=structuredClone(before);changed.product.brand='concurrent';assert.throws(()=>checkBefore(e,changed));
  const collision=structuredClone(before);collision.competingNames=[123];assert.throws(()=>checkBefore(e,collision));
  const withdrawn=structuredClone(before);withdrawn.observations=[{payload_hash:e.payloadHash}];
  assert.throws(()=>checkBefore(e,withdrawn),/withdrawn/);
  const independent=structuredClone(before);independent.provenance=[{source_type:'manual'}];assert.throws(()=>checkBefore(e,independent));
});

test('recovery callback failure occurs after locks and before snapshots, persistence or DML',async()=>{
  const entry=retainedEntries().find(e=>e.productId===195),queries=[];let saved=false;
  await assert.rejects(applyOne({query:async sql=>{queries.push(sql);return '';}},entry,{save:()=>{saved=true;}},
    {verifyRecovery:async()=>{assert.match(queries[0],/^BEGIN ISOLATION LEVEL REPEATABLE READ/);
      assert.match(queries[1],/FOR UPDATE/);throw Error('synthetic_stale_recovery');}}),/synthetic_stale_recovery/);
  assert.equal(saved,false);assert.equal(queries.at(-1),'ROLLBACK');
  assert.ok(!queries.some(sql=>sql.includes('ingestion_apply_observation')||sql.startsWith('SELECT jsonb_build_object')));
});

function rowsFixture() {
  const entry=retainedEntries().find(e=>e.productId===195),r=entry.record,b=batchFor(entry);
  const sourceId='11111111-1111-4111-8111-111111111111',batchId='22222222-2222-4222-8222-222222222222',obsId='33333333-3333-4333-8333-333333333333';
  const assertions=[];
  if(r.ingredients_state==='reported')r.ingredients.forEach((assertion,i)=>assertions.push({source_record_id:sourceId,observation_id:obsId,kind:'ingredient',position:i+1,assertion}));
  for(const kind of ['contains','traces'])r.allergen_assertions.filter(a=>a.type===kind).forEach((assertion,i)=>assertions.push({source_record_id:sourceId,observation_id:obsId,kind,position:i+1,assertion}));
  return {ingestion_batches:[{id:batchId,...b,status:'applied',counts:{accepted:1},created_at:'2026-09-08T10:00:00Z'}],
    product_source_records:[{id:sourceId,source_key:'off_api',external_id:entry.externalId,country:entry.country,product_id:entry.productId,selected_observation_id:obsId}],
    product_source_observations:[{id:obsId,source_record_id:sourceId,batch_id:batchId,source_revision:r.source_revision,
      extractor_version:b.extractor_version,payload_hash:r.payload_hash,sanitized_payload:r.sanitized_payload,extracted_fields:r.extracted_fields,
      source_url:r.source_url,license:r.license,retrieved_at:r.retrieved_at,received_at:'2026-09-08T10:00:00Z',source_updated_at:r.source_updated_at,
      validation_findings:r.validation_findings,status:'accepted',reason:null}],product_source_assertions:assertions};
}

test('populated recovery allowlist pins exact rows, approved public payload and relational closure',()=>{
  const rows=rowsFixture(),manifest=proposedPublicAllowlist(rows);
  assert.equal(validatePublicAllowlist(rows,manifest,manifest.sha256).result,'PASS');
  assert.equal(manifest.profile,'observations-public-cohort-v1');
  assert.throws(()=>validatePublicAllowlist(rows,manifest,'wrong'));
  const mutations=[r=>r.product_source_observations[0].sanitized_payload.private_user='secret',
    r=>r.product_source_observations[0].source_url='https://different.example/',
    r=>r.product_source_observations[0].retrieved_at='2026-09-08T10:00:00Z',
    r=>r.product_source_observations[0].status='quarantined',
    r=>r.product_source_records[0].product_id=999,
    r=>r.product_source_records[0].source_key='manual',
    r=>r.product_source_records[0].selected_observation_id='unbound',
    r=>r.ingestion_batches[0].idempotency_key='private-value',
    r=>r.ingestion_batches[0].extra='unexpected-column',
    r=>r.ingestion_batches=[],r=>r.product_source_observations.push(structuredClone(r.product_source_observations[0]))];
  if(rows.product_source_assertions.length)mutations.push(r=>r.product_source_assertions.pop());
  for(const mutate of mutations){const changed=structuredClone(rows);mutate(changed);assert.throws(()=>validatePublicAllowlist(changed,manifest,manifest.sha256));}
});

test('populated dump adapter requires one active read-only repeatable-read snapshot and never dumps itself',async()=>{
  const rows=rowsFixture(),manifest=proposedPublicAllowlist(rows),queries=[];
  const session={query:async sql=>{queries.push(sql);if(sql.includes("'readOnly'"))return JSON.stringify({readOnly:'on',isolation:'repeatable read'});
    if(sql.includes('pg_export_snapshot'))return '00000001-00000002-1';return JSON.stringify(rows);}};
  const result=await approvedSnapshotDumpArgs(session,{manifest,reviewedSha256:manifest.sha256,archiveFile:'/tmp/fixture.dump'});
  assert.equal(result.args.filter(a=>a.startsWith('--table=')).length,21);
  assert.equal(result.proof.productionRecoveryCertified,false);assert.equal(queries.length,3);
  await assert.rejects(approvedSnapshotDumpArgs({query:async()=>JSON.stringify({readOnly:'off',isolation:'read committed'})},
    {manifest,reviewedSha256:manifest.sha256,archiveFile:'/tmp/fixture.dump'}));
});

test('reversal SQL restores owned projection/assertions and retains observation and batch history',()=>{
  const entry=retainedEntries().find(e=>e.productId===195);
  const sql=rollbackSql(entry,{product:{},nutrition:{},provenance:[],assertions:[],source:null},
    {source:{id:'11111111-1111-4111-8111-111111111111',selected_observation_id:'22222222-2222-4222-8222-222222222222'}});
  assert.ok(!/DELETE FROM public\.(product_source_observations|product_source_records|ingestion_batches)/.test(sql));
  assert.ok(sql.includes('selected_observation_id=NULL'));
});

test('injected peer write fails inside the applying transaction before COMMIT',async()=>{
  const manifest=remainingManifest(),entry=reviewSelection(manifest,[148,195],manifest.sha256).find(e=>e.productId===195);
  const rows=rowsFixture(),r=entry.record,obs=rows.product_source_observations[0];
  const before={product:{product_id:195,country:entry.country,ean:entry.externalId,is_deprecated:false,...entry.beforeAttributes},
    nutrition:{},source:null,observations:[],provenance:[],assertions:[],identityIds:[195],competingNames:[],unaffected:{products:'peer-original'}};
  const after={...structuredClone(before),product:{...before.product,...entry.afterAttributes},source:rows.product_source_records[0],observations:[obs],
    assertions:rows.product_source_assertions,
    nutrition:Object.fromEntries(Object.entries(NUTRIENTS).map(([f,k])=>[k,r.extracted_fields[f].state==='recorded'&&r.extracted_fields[f].qualifier==='eq'?r.extracted_fields[f].value:null])),
    provenance:Object.entries(r.extracted_fields).map(([field_name,f])=>({field_name,observation_id:obs.id,evidence_state:f.state,basis:f.basis??'unknown'}))};
  const queries=[],stages=[];let snapshots=0;
  const session={query:async sql=>{
    queries.push(sql);
    if(sql.startsWith('SELECT jsonb_build_object')) {
      if(snapshots++===0)return JSON.stringify(before);
      // The fake database changes a peer during ingestion. It is visible to
      // the generated unaffected hash only when that peer is NOT excluded.
      return JSON.stringify({...after,unaffected:{products:sql.includes('product_id NOT IN (195)')?'peer-changed':'peer-original'}});
    }
    if(sql.startsWith('SELECT public.ingestion_apply_observation'))return JSON.stringify({status:'accepted',product_id:195,observation_id:obs.id});
    return '';
  }};
  await assert.rejects(applyOne(session,entry,{save:stage=>{stages.push(stage);return 'hash';}}),error=>error.code==='cohort_selected_postcondition_failed');
  assert.ok(!queries.includes('COMMIT'));assert.ok(queries.includes('ROLLBACK'));
  assert.deepEqual(stages,['before']);
});

test('rollback permits unrelated drift but rejects every target change and writes outside target',async()=>{
  const entry=retainedEntries().find(e=>e.productId===195);
  const before={product:{product_id:195,brand:'before',updated_at:'old'},nutrition:{salt_g:'1.00',updated_at:'old'},
    source:null,observations:[],provenance:[],assertions:[],model:{name:'before'},identityIds:[195],competingNames:[],unaffected:{products:'old'}};
  const after={...structuredClone(before),product:{...before.product,brand:'after'},source:{id:'11111111-1111-4111-8111-111111111111',selected_observation_id:'22222222-2222-4222-8222-222222222222'},
    observations:[{id:'22222222-2222-4222-8222-222222222222'}],model:{name:'after'}};
  const current={...structuredClone(after),unaffected:{products:'new-unrelated-state'}};
  const restored={...structuredClone(before),source:{...after.source,selected_observation_id:null},observations:after.observations,unaffected:current.unaffected};
  async function run(now,end) {
    const queries=[];let snapshots=0;
    const session={query:async sql=>{queries.push(sql);return sql.startsWith('SELECT jsonb_build_object')?JSON.stringify(snapshots++?end:now):'';}};
    try {return {value:await rollbackOne(session,{entry,before,after},{save:()=> 'hash'}),queries};}
    catch(error){error.queries=queries;throw error;}
  }
  assert.equal((await run(current,restored)).value.result,'REVERSED');
  assert.deepEqual(targetSnapshot(current),targetSnapshot(after));
  for(const key of Object.keys(targetSnapshot(after))) {
    const changed=structuredClone(current);changed[key]={unexpected:'changed'};
    await assert.rejects(run(changed,restored),error=>error.code==='cohort_rollback_cas_changed'&&!error.queries.some(q=>q.startsWith('UPDATE')));
  }
  await assert.rejects(run(current,{...restored,unaffected:{products:'escaped-write'}}),error=>error.code==='cohort_rollback_postcondition_failed');
});

test('batch completion rechecks prior peers while unrelated global changes remain allowed',async()=>{
  const entry=retainedEntries().find(e=>e.productId===195),after={product:{brand:'expected'},unaffected:{products:'old'}};
  let closed=0;
  const connect=current=>async()=>({query:async()=>JSON.stringify(current),close:async()=>{closed++;}});
  assert.equal((await verifyBatchPostimages(connect({...after,unaffected:{products:'new'}}),[{entry,after}])).result,'PASS');
  await assert.rejects(verifyBatchPostimages(connect({...after,product:{brand:'changed'}}),[{entry,after}]),/peer_postimage/);
  assert.equal(closed,2);
});
