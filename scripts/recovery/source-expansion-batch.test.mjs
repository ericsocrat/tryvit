import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {hash} from '../ci/database-release.mjs';
import {batchFor,digest} from './cohort-batch.mjs';
import {loadExpansionManifest,reviewExpansionSelection,semanticManifestSha256} from './source-expansion-batch.mjs';
import {retainedEntries} from './cohort-batch.mjs';
import {syntheticRetainedSource} from './cohort-synthetic-fixture.mjs';
import {proposedPublicAllowlist,validatePublicAllowlist} from './cohort-public-recovery.mjs';

function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tryvit-expansion-'));
  const directory=path.join(root,'audit-reports','source-expansion','run-v1');fs.mkdirSync(directory,{recursive:true});
  const source=syntheticRetainedSource(),base=retainedEntries(source)[0],entries=[];
  for(let index=0;index<102;index++) {
    const productId=10_000+index,record={...structuredClone(base.record),external_id:String(5900000000000+index),
      identity:{...base.record.identity,ean:String(5900000000000+index)}};
    record.sanitized_payload={...record.sanitized_payload,extractor_version:'off-observations-v2',projected_identity:record.identity,
      code:record.external_id};
    record.payload_canonical=JSON.stringify(record.sanitized_payload);
    record.payload_hash=hash(Buffer.from(record.payload_canonical));
    const recordFile=`PL-${productId}-${record.external_id}.observation.json`,bytes=Buffer.from(JSON.stringify(record));
    fs.writeFileSync(path.join(directory,recordFile),bytes);
    entries.push({productId,country:'PL',externalId:record.external_id,recordFile,recordSha256:hash(bytes),payloadHash:record.payload_hash,
      beforeAttributes:{brand:record.identity.brand,product_name:record.identity.product_name,category:record.identity.category},
      afterAttributes:{brand:record.identity.brand,product_name:record.identity.product_name,category:record.identity.category},
      batchProfile:'source-expansion-v1',selectionRationale:{},extractorVersion:'off-observations-v2',nutritionBasis:['per_100g'],
      ingredientsExplicit:false,allergenEvidenceExplicit:false});
  }
  const body={schemaVersion:1,profile:'source-expansion-cohort-v1',selectionSourceHead:'a'.repeat(40),selectionSha256:'b'.repeat(64),
    acquisitionReceiptSha256:'c'.repeat(64),acquisitionManifestSha256:'d'.repeat(64),productionIdentityReviewSha256:'e'.repeat(64),
    productionCheckedAt:'2026-09-19T20:00:00Z',activeProductsAtReview:2434,selectedSourcesBefore:55,
    selectedCount:150,entries,held:Array.from({length:48},(_,index)=>({productId:20_000+index})),
    notFound:[],fetchFailed:[]};
  const manifest={...body,manifestSha256:semanticManifestSha256({...body,manifestSha256:'0'.repeat(64)})};
  const file=path.join(directory,'release-manifest.json'),bytes=Buffer.from(JSON.stringify(manifest));fs.writeFileSync(file,bytes);
  return {root,file,fileSha256:hash(bytes),manifest};
}

test('expansion manifest binds exact file, records and accepted/held partition',()=>{
  const value=fixture(),manifest=loadExpansionManifest(value.file,value.fileSha256,{root:value.root});
  assert.equal(manifest.entries.length,102);assert.equal(manifest.held.length,48);
  assert.throws(()=>loadExpansionManifest(value.file,'0'.repeat(64),{root:value.root}),/exact_manifest/);
  const changed=Buffer.from(fs.readFileSync(path.join(manifest.recordRoot,manifest.entries[0].recordFile)));
  changed[0]^=1;fs.writeFileSync(path.join(manifest.recordRoot,manifest.entries[0].recordFile),changed);
  assert.throws(()=>loadExpansionManifest(value.file,value.fileSha256,{root:value.root}),/record_hash_changed/);
});

test('selection admits the reviewed cohort in batches of at most five',()=>{
  const value=fixture(),manifest=loadExpansionManifest(value.file,value.fileSha256,{root:value.root});
  const ids=manifest.entries.slice(0,5).map(entry=>entry.productId),selected=reviewExpansionSelection(manifest,ids,value.fileSha256);
  assert.equal(selected.length,5);assert.ok(selected.every(entry=>entry.batchScope.length===5));
  assert.match(batchFor(selected[0]).idempotency_key,/^source-expansion-v1:PL:/u);
  assert.equal(batchFor(selected[0]).scope.cohort,'source-expansion-v1');
  const release=reviewExpansionSelection(manifest,manifest.entries.map(entry=>entry.productId),value.fileSha256);
  assert.equal(release.length,102);assert.ok(release.every(entry=>entry.batchScope.length<=5));
  assert.deepEqual(release[0].batchScope,release[4].batchScope);assert.notDeepEqual(release[4].batchScope,release[5].batchScope);
  assert.throws(()=>reviewExpansionSelection(manifest,[manifest.held[0].productId],value.fileSha256));
  assert.equal(digest(selected[0].beforeAttributes),digest(selected[0].afterAttributes));
});

test('populated recovery allowlist carries applied expansion evidence beside the frozen original cohort',()=>{
  const value=fixture(),loaded=loadExpansionManifest(value.file,value.fileSha256,{root:value.root}),entry=loaded.entries[0];
  const batch=batchFor(entry),batchId='11111111-1111-4111-8111-111111111111';
  const sourceId='22222222-2222-4222-8222-222222222222',observationId='33333333-3333-4333-8333-333333333333';
  const assertions=[];
  if(entry.record.ingredients_state==='reported')entry.record.ingredients.forEach((assertion,index)=>
    assertions.push({source_record_id:sourceId,observation_id:observationId,kind:'ingredient',position:index+1,assertion}));
  for(const kind of ['contains','traces'])entry.record.allergen_assertions.filter(assertion=>assertion.type===kind).forEach((assertion,index)=>
    assertions.push({source_record_id:sourceId,observation_id:observationId,kind,position:index+1,assertion}));
  const rows={
    ingestion_batches:[{id:batchId,...batch,status:'applied',counts:{accepted:1},created_at:'2026-09-19T18:00:00Z'}],
    product_source_records:[{id:sourceId,source_key:'off_api',external_id:entry.externalId,country:'PL',product_id:entry.productId,
      selected_observation_id:observationId}],
    product_source_observations:[{id:observationId,source_record_id:sourceId,batch_id:batchId,
      source_revision:entry.record.source_revision,extractor_version:'off-observations-v2',payload_hash:entry.record.payload_hash,
      sanitized_payload:entry.record.sanitized_payload,extracted_fields:entry.record.extracted_fields,source_url:entry.record.source_url,
      license:entry.record.license,retrieved_at:entry.record.retrieved_at,received_at:'2026-09-19T18:00:00Z',
      source_updated_at:entry.record.source_updated_at,validation_findings:entry.record.validation_findings,status:'accepted',reason:null}],
    product_source_assertions:assertions,
  };
  const publicInput={retainedSource:syntheticRetainedSource(),sourceExpansionEntries:[entry]};
  const manifest=proposedPublicAllowlist(rows,publicInput);
  assert.equal(manifest.sourceExpansionEntries.length,1);
  assert.equal(validatePublicAllowlist(rows,manifest,manifest.sha256,publicInput).result,'PASS');
  const changed=structuredClone(rows);changed.product_source_observations[0].payload_hash='0'.repeat(64);
  assert.throws(()=>validatePublicAllowlist(changed,manifest,manifest.sha256,publicInput));
});
