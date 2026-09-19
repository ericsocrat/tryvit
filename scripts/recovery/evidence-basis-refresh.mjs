/** Exact retained-source OFF v2 basis refresh. No production transport. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {RecoveryError} from './catalog-recovery.mjs';
import {retainedEntries,retainedRecoveryEntries,locks,snapshotSql as cohortSnapshot,rollbackSql,targetSnapshot,equal,digest,NUTRIENTS,jsonSql} from './cohort-batch.mjs';
import {revisionNumber,timestampMicros} from './cohort-pilot-operator.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const MATRIX='audit-reports/evidence-basis-recovery/selected-observations-20260919.json';
export const MATRIX_SHA256='97ce5c8744427846c5cef9c66ee30f343caf176ec6c9807c010ac1d8c5deced7';
export const EXTRACTOR_V1='off-observations-v1';
export const EXTRACTOR_V2='off-observations-v2';
const fail=code=>{throw new RecoveryError(code);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

export function explicitBasis(payload) {
  const declared={'100g':'per_100g','100ml':'per_100ml'}[payload?.nutrition_data_per];
  const unit={g:'per_100g',ml:'per_100ml'}[payload?.nutrition_data_per_unit];
  return !declared||(unit&&unit!==declared)?'unknown':declared;
}

export function deriveV2Record(retained,row,matrix,matrixSha256=MATRIX_SHA256) {
  const source=retained.record;
  if(source.sanitized_payload?.extractor_version!==EXTRACTOR_V1||source.payload_hash!==row.payload_hash||
    source.payload_hash!==row.exact_source_evidence.match(/[a-f0-9]{64}$/)?.[0])fail('refresh_source_hash_mismatch');
  if(sha(Buffer.from(source.payload_canonical))!==source.payload_hash||!equal(JSON.parse(source.payload_canonical),source.sanitized_payload))
    fail('refresh_source_canonical_mismatch');
  const basis=explicitBasis(source.sanitized_payload);
  if(basis!==row.proposed_basis||!['per_100g','per_100ml'].includes(basis))fail('refresh_matrix_basis_mismatch');
  const record=structuredClone(source);
  for(const field of Object.keys(NUTRIENTS))record.extracted_fields[field].basis=basis;
  record.sanitized_payload.extractor_version=EXTRACTOR_V2;
  record.sanitized_payload.extraction=structuredClone(record.extracted_fields);
  record.sanitized_payload.derivation={kind:'existing-source-basis-refresh-v2',source_payload_hash:source.payload_hash,
    source_observation_id:row.selected_observation_id,matrix_sha256:matrixSha256,extracted_at:matrix.generated_at};
  record.payload_canonical=JSON.stringify(Object.fromEntries(Object.entries(record.sanitized_payload).sort()),(_key,value)=>
    value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort()):value);
  // JSON.stringify's replacer sorts recursively before each object is emitted.
  record.payload_hash=sha(Buffer.from(record.payload_canonical));
  return record;
}

export function refreshManifest({readFile=file=>fs.readFileSync(path.join(ROOT,file)),retainedSource,
  expectedMatrixSha256=MATRIX_SHA256}={}) {
  const bytes=readFile(MATRIX);
  if(sha(bytes)!==expectedMatrixSha256)fail('refresh_matrix_hash_mismatch');
  const matrix=JSON.parse(bytes),rows=matrix.observations;
  if(matrix.counts?.selected_observations!==55||rows?.length!==55||matrix.counts?.A!==55||matrix.counts?.B!==0||matrix.counts?.C!==0)
    fail('refresh_matrix_membership_mismatch');
  const retained=retainedEntries(retainedSource),entries=rows.map(row=>{
    const source=retained.find(entry=>entry.productId===Number(row.product_id));
    if(!source||source.externalId!==row.external_id||source.payloadHash!==row.payload_hash||row.recoverability_class!=='A'||!uuid(row.selected_observation_id))
      fail('refresh_matrix_source_binding_mismatch');
    const record=deriveV2Record(source,row,matrix,expectedMatrixSha256);
    return {productId:source.productId,country:source.country,externalId:source.externalId,sourceKey:source.record.sanitized_payload.observation_metadata?.source_key??'off_api',
      oldObservationId:row.selected_observation_id,oldPayloadHash:source.payloadHash,oldRecordSha256:source.recordSha256,
      expectedBasis:row.proposed_basis,newPayloadHash:record.payload_hash,extractedAt:matrix.generated_at};
  }).sort((a,b)=>a.productId-b.productId);
  if(new Set(entries.map(e=>e.productId)).size!==55||entries.filter(e=>e.expectedBasis==='per_100g').length!==48||entries.filter(e=>e.expectedBasis==='per_100ml').length!==7)
    fail('refresh_expected_basis_counts_mismatch');
  const reviewed={schemaVersion:1,profile:'existing-source-basis-refresh-v2',matrixSha256:expectedMatrixSha256,
    extractorVersion:EXTRACTOR_V2,entries};
  return {...reviewed,sha256:digest(reviewed)};
}

// Public recovery validates the already-applied v2 lineage from immutable
// source evidence. It deliberately does not require the historical mutation
// plan or its product before-images.
export function refreshRecoveryEntries({readFile=file=>fs.readFileSync(path.join(ROOT,file)),retainedSource,
  expectedMatrixSha256=MATRIX_SHA256}={}) {
  const bytes=readFile(MATRIX);
  if(sha(bytes)!==expectedMatrixSha256)fail('refresh_matrix_hash_mismatch');
  const matrix=JSON.parse(bytes),rows=matrix.observations,retained=retainedRecoveryEntries(retainedSource);
  if(matrix.counts?.selected_observations!==55||rows?.length!==55||matrix.counts?.A!==55||matrix.counts?.B!==0||matrix.counts?.C!==0)
    fail('refresh_matrix_membership_mismatch');
  const entries=rows.map(row=>{
    const source=retained.find(entry=>entry.productId===Number(row.product_id));
    if(!source||source.externalId!==row.external_id||source.payloadHash!==row.payload_hash||
      row.recoverability_class!=='A'||!uuid(row.selected_observation_id))fail('refresh_matrix_source_binding_mismatch');
    const record=deriveV2Record(source,row,matrix,expectedMatrixSha256);
    return {...source,oldObservationId:row.selected_observation_id,oldPayloadHash:source.payloadHash,
      expectedBasis:row.proposed_basis,newPayloadHash:record.payload_hash,matrixSha256:expectedMatrixSha256,
      operation:'existing-source-basis-refresh-v2',record};
  }).sort((a,b)=>a.productId-b.productId);
  if(new Set(entries.map(entry=>entry.productId)).size!==55||entries.filter(entry=>entry.expectedBasis==='per_100g').length!==48||
    entries.filter(entry=>entry.expectedBasis==='per_100ml').length!==7)fail('refresh_expected_basis_counts_mismatch');
  return entries;
}

export function refreshSelection(manifest,ids,confirmedSha256,{readFile,retainedSource,expectedMatrixSha256=MATRIX_SHA256}={}) {
  const current=refreshManifest({readFile,retainedSource,expectedMatrixSha256});
  if(!equal(manifest,current)||confirmedSha256!==current.sha256)fail('refresh_exact_manifest_review_required');
  if(!Array.isArray(ids)||ids.length<1||ids.length>5||new Set(ids).size!==ids.length)fail('refresh_batch_size_or_duplicates');
  const matrix=JSON.parse((readFile??(file=>fs.readFileSync(path.join(ROOT,file))))(MATRIX));
  const retained=retainedEntries(retainedSource);
  return ids.map(id=>{
    const plan=current.entries.find(e=>e.productId===id),source=retained.find(e=>e.productId===id),row=matrix.observations.find(e=>Number(e.product_id)===id);
    if(!plan||!source||!row)fail('refresh_product_outside_manifest');
    return {...source,...plan,sourceRecord:source.record,matrixSha256:current.matrixSha256,
      operation:'existing-source-basis-refresh-v2',record:deriveV2Record(source,row,matrix,expectedMatrixSha256)};
  }).sort((a,b)=>a.country.localeCompare(b.country)||a.externalId.localeCompare(b.externalId));
}

export function refreshBatch(entry) {
  const matrixSha256=entry.matrixSha256??MATRIX_SHA256;
  return {source_key:'off_api',country:entry.country,extractor_version:EXTRACTOR_V2,
    idempotency_key:`basis-refresh-v2:${matrixSha256}:${entry.productId}:${entry.newPayloadHash}`,
    scope:{kind:'existing_source_basis_refresh',product_id:entry.productId,matrix_sha256:matrixSha256}};
}
export const snapshotSql=entry=>cohortSnapshot(entry,{batch:refreshBatch(entry)});

const withoutTechnical=value=>{const copy=structuredClone(value);if(copy&&typeof copy==='object')delete copy.updated_at;return copy;};
const assertionContent=rows=>rows.map(({observation_id,...row})=>row);
function expectedObservation(entry,snapshot) {return snapshot.observations.find(o=>o.payload_hash===entry.newPayloadHash&&o.extractor_version===EXTRACTOR_V2);}

function checkAppliedState(entry,current) {
  const target=expectedObservation(entry,current),old=current.observations.find(o=>o.id===entry.oldObservationId);
  if(!target||!old||old.payload_hash!==entry.oldPayloadHash||old.extractor_version!==EXTRACTOR_V1||current.observations.length!==2||
    current.source?.selected_observation_id!==target.id||target.status!=='accepted'||
    revisionNumber(target.source_revision)!==revisionNumber(entry.record.source_revision)||
    timestampMicros(target.retrieved_at)!==timestampMicros(entry.record.retrieved_at)||
    timestampMicros(target.source_updated_at,{nullable:true})!==timestampMicros(entry.record.source_updated_at,{nullable:true})||
    current.assertions.some(row=>row.observation_id!==target.id))
    fail('refresh_existing_v2_postcondition_failed');
  for(const [field,value] of Object.entries(entry.record.extracted_fields)) {
    const p=current.provenance.find(row=>row.field_name===field),expectedBasis=Object.hasOwn(NUTRIENTS,field)?entry.expectedBasis:value.basis??'unknown';
    if(!p||p.observation_id!==target.id||p.evidence_state!==value.state||p.basis!==expectedBasis)
      fail('refresh_existing_v2_postcondition_failed');
  }
  for(const [field,column] of Object.entries(NUTRIENTS)) {
    const value=entry.record.extracted_fields[field],expected=value.state==='recorded'&&value.qualifier==='eq'?String(value.value):null;
    if(expected===null?current.nutrition[column]!==null:String(current.nutrition[column])!==expected)
      fail('refresh_existing_v2_postcondition_failed');
  }
}

export function checkRefreshBefore(entry,before) {
  if(!before.product||before.product.product_id!==entry.productId||before.product.country!==entry.country||before.product.ean!==entry.externalId||before.product.is_deprecated||
    !equal(before.identityIds,[entry.productId])||before.competingNames.length||before.source?.product_id!==entry.productId||before.source?.source_key!=='off_api')
    fail('refresh_product_or_source_identity_changed');
  const old=before.observations.find(o=>o.id===entry.oldObservationId);
  if(!old||old.payload_hash!==entry.oldPayloadHash||old.extractor_version!==EXTRACTOR_V1||old.status!=='accepted')fail('refresh_old_observation_mismatch');
  const target=expectedObservation(entry,before);
  if(target) {
    if(before.source.selected_observation_id!==target.id||before.observations.length!==2)fail('refresh_existing_v2_partial_or_unselected');
    return 'already-selected';
  }
  if(before.source.selected_observation_id!==entry.oldObservationId||before.observations.length!==1||
    before.assertions.some(row=>row.observation_id!==entry.oldObservationId)||
    before.provenance.some(row=>row.observation_id!==entry.oldObservationId))fail('refresh_selected_v1_preimage_mismatch');
  return 'apply';
}

export function checkRefreshAfter(entry,before,after) {
  const target=expectedObservation(entry,after),old=after.observations.find(o=>o.id===entry.oldObservationId);
  if(!target||target.status!=='accepted'||revisionNumber(target.source_revision)!==revisionNumber(entry.record.source_revision)||
    timestampMicros(target.retrieved_at)!==timestampMicros(entry.record.retrieved_at)||
    timestampMicros(target.source_updated_at,{nullable:true})!==timestampMicros(entry.record.source_updated_at,{nullable:true})||
    after.source?.selected_observation_id!==target.id||!equal(after.source,{...before.source,selected_observation_id:target.id})||
    after.observations.length!==2||!old||!equal(old,before.observations.find(o=>o.id===entry.oldObservationId))||
    !equal(withoutTechnical(before.product),withoutTechnical(after.product))||!equal(withoutTechnical(before.nutrition),withoutTechnical(after.nutrition))||
    !equal(before.identityIds,after.identityIds)||!equal(before.competingNames,after.competingNames)||!equal(before.unaffected,after.unaffected)||
    before.provenance.length!==after.provenance.length||!equal(assertionContent(before.assertions),assertionContent(after.assertions))||
    after.assertions.some(row=>row.observation_id!==target.id))
    fail('refresh_target_postcondition_failed');
  for(const [field,prior] of Object.entries(entry.record.extracted_fields)) {
    const p=after.provenance.find(row=>row.field_name===field),oldp=before.provenance.find(row=>row.field_name===field);
    const expectedBasis=Object.hasOwn(NUTRIENTS,field)?entry.expectedBasis:prior.basis??'unknown';
    if(!p||!oldp||p.observation_id!==target.id||p.evidence_state!==prior.state||p.basis!==expectedBasis||
      p.unit!==oldp.unit||p.qualifier!==oldp.qualifier||p.preparation_state!==oldp.preparation_state)fail('refresh_provenance_postcondition_failed');
  }
}

export async function applyRefreshOne(session,entry,store,{verifyRecovery}={}) {
  let committing=false;
  try {
    await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await session.query(locks(entry));
    if(verifyRecovery)await verifyRecovery(session);
    const before=JSON.parse(await session.query(snapshotSql(entry))),disposition=checkRefreshBefore(entry,before);
    if(disposition==='already-selected') {checkAppliedState(entry,before);await session.query('ROLLBACK');return {result:'ALREADY_APPLIED_NO_WRITE',productId:entry.productId};}
    const beforeHash=store.save('before',{entry,before});
    const result=JSON.parse(await session.query(`SELECT public.ingestion_apply_observation(${jsonSql(refreshBatch(entry))},${jsonSql(entry.record)})`));
    if(result.status!=='accepted'||result.product_id!==entry.productId)fail('refresh_ingestion_did_not_accept_exact_product');
    const after=JSON.parse(await session.query(snapshotSql(entry)));checkRefreshAfter(entry,before,after);
    store.save('after',{entry,before,after,beforeEncryptedSha256:beforeHash});committing=true;await session.query('COMMIT');
    return {result:'APPLIED',productId:entry.productId,observationId:result.observation_id,beforeEncryptedSha256:beforeHash};
  } catch(error) {await session.query('ROLLBACK').catch(()=>{});if(committing)fail('refresh_commit_uncertain_inspect_no_retry');throw error;}
}

export async function verifyRefreshPostimages(connect,envelopes) {
  for(const {entry,after} of envelopes) {const session=await connect();try {const current=JSON.parse(await session.query(snapshotSql(entry)));
    if(!equal(targetSnapshot(current),targetSnapshot(after)))fail('refresh_batch_peer_postimage_changed');}finally {await session.close();}}
  return {result:'PASS',verifiedProducts:envelopes.map(e=>e.entry.productId)};
}

export function inspectRefreshOutcome({before,after},current) {
  if(equal(targetSnapshot(current),targetSnapshot(after)))return 'APPLIED_MATCHING_POSTIMAGE';
  const omit=value=>withoutTechnical(value);
  const restored=equal(omit(current.product),omit(before.product))&&equal(omit(current.nutrition),omit(before.nutrition))&&
    equal(current.provenance,before.provenance)&&equal(current.assertions,before.assertions)&&equal(current.model,before.model)&&
    equal(current.observations,after.observations)&&equal(current.identityIds,before.identityIds)&&equal(current.competingNames,before.competingNames)&&
    equal(current.source,{...after.source,selected_observation_id:before.source.selected_observation_id});
  return restored?'REVERSED_MATCHING_BASELINE':'DRIFT_REQUIRES_REVIEW';
}

export async function rollbackRefreshOne(session,envelope,store,{verifyRecovery}={}) {
  const {entry,before,after}=envelope;let committing=false;
  try {
    await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await session.query(locks(entry));
    if(verifyRecovery)await verifyRecovery(session);
    const current=JSON.parse(await session.query(snapshotSql(entry)));
    if(!equal(targetSnapshot(current),targetSnapshot(after)))fail('refresh_rollback_cas_changed');
    await session.query(rollbackSql(entry,before,after));
    const restored=JSON.parse(await session.query(snapshotSql(entry)));
    if(inspectRefreshOutcome(envelope,restored)!=='REVERSED_MATCHING_BASELINE'||!equal(current.unaffected,restored.unaffected))
      fail('refresh_rollback_postcondition_failed');
    const proof=store.save('reversal',{entry,before,after,restored});committing=true;await session.query('COMMIT');
    return {result:'REVERSED',productId:entry.productId,immutableHistoryRetained:true,reversalEncryptedSha256:proof};
  } catch(error){await session.query('ROLLBACK').catch(()=>{});if(committing)fail('refresh_rollback_commit_uncertain');throw error;}
}

export async function applyReviewedRefreshBatch({manifest,productIds,confirmedSha256,connect,storeFor,verifyRecovery,source}) {
  const selected=refreshSelection(manifest,productIds,confirmedSha256,source),results=[],postimages=[];
  for(const entry of selected) {const session=await connect(),store=storeFor(entry);try {
    const result=await applyRefreshOne(session,entry,{...store,save(stage,value){const receipt=store.save(stage,value);if(stage==='after')postimages.push({entry,after:value.after});return receipt;}},
      {verifyRecovery:verifyRecovery?s=>verifyRecovery(s,{index:results.length,entry}):undefined});results.push(result);
  } catch(error){results.push({result:'HOLD',productId:entry.productId,code:error instanceof RecoveryError?error.code:'refresh_failure'});break;}
  finally {store.close?.();await session.close();}}
  let peerPostimages={result:'PASS',verifiedProducts:postimages.map(e=>e.entry.productId)};
  if(postimages.length)try{peerPostimages=await verifyRefreshPostimages(connect,postimages);}catch(error){peerPostimages={result:'HOLD',code:error.code??'refresh_peer_check_failed'};}
  return {result:results.length===selected.length&&!results.some(r=>r.result==='HOLD')&&peerPostimages.result==='PASS'?'PASS':'HOLD',results,peerPostimages,
    remainingNotAttempted:selected.slice(results.length).map(e=>e.productId)};
}
