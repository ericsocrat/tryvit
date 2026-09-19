import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {syntheticRetainedSource} from './cohort-synthetic-fixture.mjs';
import {MATRIX,EXTRACTOR_V1,EXTRACTOR_V2,explicitBasis,refreshManifest,refreshSelection,refreshBatch,checkRefreshBefore} from './evidence-basis-refresh.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;

function fixture() {
  const source=syntheticRetainedSource();
  const planKey='audit-reports/evidence-cohort/production-import-plan-20260908/plan.json';
  const receiptKey='audit-reports/evidence-cohort/run-20260905T101700Z/receipt.json';
  const plan=JSON.parse(source.files.get(planKey)),receipt=JSON.parse(source.files.get(receiptKey));
  const held=new Set([628,2882,2903,2950,6029]),selected=plan.members.filter(member=>!held.has(member.product_id));
  const rows=[];
  selected.forEach((member,index)=>{
    const retained=receipt.members.find(row=>row.product_id===member.product_id),key=`audit-reports/evidence-cohort/run-20260905T101700Z/${retained.observation_file}`;
    const record=JSON.parse(source.files.get(key)),basis=index<7?'100ml':'100g';
    record.external_id=member.ean;record.identity.ean=member.ean;record.sanitized_payload.code=member.ean;
    record.sanitized_payload.extractor_version=EXTRACTOR_V1;record.sanitized_payload.nutrition_data_per=basis;
    record.sanitized_payload.nutrition_data_per_unit=null;
    for(const field of Object.keys(record.extracted_fields))if(field.endsWith('_100g'))record.extracted_fields[field].basis=index<7?'per_100ml':'unknown';
    record.sanitized_payload.extraction=structuredClone(record.extracted_fields);
    record.sanitized_payload.projected_identity=structuredClone(record.identity);
    record.payload_canonical=JSON.stringify(stable(record.sanitized_payload));record.payload_hash=sha(Buffer.from(record.payload_canonical));
    const bytes=Buffer.from(JSON.stringify(record));source.files.set(key,bytes);retained.observation_sha256=sha(bytes);
    member.record_sha256=sha(bytes);member.payload_hash=record.payload_hash;
    rows.push({product_id:member.product_id,product_name:record.identity.product_name,selected_observation_id:`00000000-0000-4000-8000-${String(member.product_id).padStart(12,'0')}`,
      source_identity:'off_api',external_id:member.ean,payload_hash:record.payload_hash,current_basis:index<7?'per_100ml':'unknown',
      relevant_source_basis_fields:{nutrition_data_per:basis,nutrition_data_per_unit:null},recoverability_class:'A',
      proposed_basis:index<7?'per_100ml':'per_100g',exact_source_evidence:`retained ${record.payload_hash}`,blocker_reason:null});
  });
  const planBytes=Buffer.from(JSON.stringify(plan)),receiptBytes=Buffer.from(JSON.stringify(receipt));
  source.files.set(planKey,planBytes);source.files.set(receiptKey,receiptBytes);source.planSha256=sha(planBytes);
  const matrix={schema_version:'fixture',generated_at:'2026-09-19T12:00:00Z',counts:{selected_observations:55,A:55,B:0,C:0},observations:rows};
  const matrixBytes=Buffer.from(JSON.stringify(matrix)),matrixSha256=sha(matrixBytes);
  const readFile=file=>file===MATRIX?matrixBytes:source.readFile(file);
  return {source,readFile,matrixSha256};
}

test('v2 exact basis mapping never uses unit alone and conflicts fail closed',()=>{
  assert.equal(explicitBasis({nutrition_data_per:'100g'}),'per_100g');
  assert.equal(explicitBasis({nutrition_data_per:'100ml'}),'per_100ml');
  assert.equal(explicitBasis({nutrition_data_per:'100g',nutrition_data_per_unit:'ml'}),'unknown');
  assert.equal(explicitBasis({nutrition_data_per_unit:'g'}),'unknown');
  assert.equal(explicitBasis({nutrition_data_per:'100 g'}),'unknown');
});

test('refresh manifest binds all 55 old hashes and deterministic v2 results',()=>{
  const f=fixture(),manifest=refreshManifest({readFile:f.readFile,retainedSource:f.source,expectedMatrixSha256:f.matrixSha256});
  assert.equal(manifest.entries.length,55);assert.equal(manifest.extractorVersion,EXTRACTOR_V2);
  assert.equal(manifest.entries.filter(entry=>entry.expectedBasis==='per_100g').length,48);
  assert.equal(manifest.entries.filter(entry=>entry.expectedBasis==='per_100ml').length,7);
  assert.equal(new Set(manifest.entries.map(entry=>entry.newPayloadHash)).size,55);
  const entry=refreshSelection(manifest,[178],manifest.sha256,{readFile:f.readFile,retainedSource:f.source,expectedMatrixSha256:f.matrixSha256})[0];
  assert.equal(entry.record.sanitized_payload.derivation.source_payload_hash,entry.oldPayloadHash);
  assert.equal(entry.record.sanitized_payload.derivation.source_observation_id,entry.oldObservationId);
  assert.equal(entry.record.sanitized_payload.derivation.matrix_sha256,f.matrixSha256);
  assert.equal(entry.record.sanitized_payload.extractor_version,EXTRACTOR_V2);
  assert.equal(refreshBatch(entry).extractor_version,EXTRACTOR_V2);
});

test('matrix, source, selection and batch drift are rejected before SQL',()=>{
  const f=fixture(),manifest=refreshManifest({readFile:f.readFile,retainedSource:f.source,expectedMatrixSha256:f.matrixSha256});
  assert.throws(()=>refreshManifest({...f,expectedMatrixSha256:'0'.repeat(64)}),/matrix_hash/);
  assert.throws(()=>refreshSelection(manifest,[178],manifest.sha256+'x',{readFile:f.readFile,retainedSource:f.source,expectedMatrixSha256:f.matrixSha256}),/exact_manifest/);
  for(const ids of [[],[178,178],[178,148,195,200,398,399],[999999]])
    assert.throws(()=>refreshSelection(manifest,ids,manifest.sha256,{readFile:f.readFile,retainedSource:f.source,expectedMatrixSha256:f.matrixSha256}));
});

test('preimage requires exact selected v1 and rejects existing unselected v2',()=>{
  const f=fixture(),manifest=refreshManifest({readFile:f.readFile,retainedSource:f.source,expectedMatrixSha256:f.matrixSha256});
  const entry=refreshSelection(manifest,[178],manifest.sha256,{readFile:f.readFile,retainedSource:f.source,expectedMatrixSha256:f.matrixSha256})[0];
  const old={id:entry.oldObservationId,payload_hash:entry.oldPayloadHash,extractor_version:EXTRACTOR_V1,status:'accepted'};
  const before={product:{product_id:entry.productId,country:entry.country,ean:entry.externalId,is_deprecated:false},source:{product_id:entry.productId,source_key:'off_api',selected_observation_id:entry.oldObservationId},
    observations:[old],assertions:[],provenance:[],identityIds:[entry.productId],competingNames:[]};
  assert.equal(checkRefreshBefore(entry,before),'apply');
  const unselected=structuredClone(before);unselected.observations.push({id:'11111111-1111-4111-8111-111111111111',payload_hash:entry.newPayloadHash,extractor_version:EXTRACTOR_V2,status:'accepted'});
  assert.throws(()=>checkRefreshBefore(entry,unselected),/partial_or_unselected/);
  const drift=structuredClone(before);drift.source.selected_observation_id='22222222-2222-4222-8222-222222222222';
  assert.throws(()=>checkRefreshBefore(entry,drift),/preimage/);
});
