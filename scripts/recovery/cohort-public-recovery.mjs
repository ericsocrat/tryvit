/** Populated21 policy adapter; no remote transport or pg_dump execution. */
import {scopeTables,dumpArgs} from './catalog-recovery.mjs';
import {retainedEntries,equal,digest,fail,batchFor,checkAssertions} from './cohort-batch.mjs';
import {pilotPlan} from './cohort-pilot.mjs';
import {ingestionInputs} from './cohort-pilot-operator.mjs';
import {timestampMicros,revisionNumber} from './cohort-pilot-operator.mjs';

export const PROFILE='observations-public-cohort-v1';
export const SOURCE_TABLES=Object.freeze(['ingestion_batches','product_source_records','product_source_observations','product_source_assertions']);
const fields={
  ingestion_batches:['id','source_key','country','extractor_version','idempotency_key','scope','status','counts','created_at'],
  product_source_records:['id','source_key','external_id','country','product_id','selected_observation_id'],
  product_source_observations:['id','source_record_id','batch_id','source_revision','extractor_version','payload_hash','sanitized_payload','extracted_fields',
    'source_url','license','retrieved_at','received_at','source_updated_at','validation_findings','status','reason'],
  product_source_assertions:['source_record_id','observation_id','kind','position','assertion'],
};
const id=t=>t==='product_source_assertions'?r=>`${r.source_record_id}:${r.kind}:${r.position}`:r=>r.id;
const rowsFingerprint=(table,rows)=>rows.map(row=>({id:id(table)(row),rowSha256:digest(row)})).sort((a,b)=>a.id.localeCompare(b.id));
export const publicSnapshotSql=`SELECT jsonb_build_object(${SOURCE_TABLES.map(t=>
  `'${t}',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text COLLATE "C"),'[]'::jsonb) FROM public.${t} r)`).join(',')})`;

function verifyPublicRows(rows,input={}) {
  if(!equal(Object.keys(rows).sort(),[...SOURCE_TABLES].sort()))fail('public_cohort_unexpected_table_set');
  const eligible=retainedEntries(input.retainedSource).filter(e=>!e.holdReasons.length||equal(e.holdReasons,['identity_text_change_requires_review']));
  for(const table of SOURCE_TABLES) {
    if(!Array.isArray(rows[table])||rows[table].length>10000)fail('public_cohort_invalid_row_set');
    for(const row of rows[table])if(!equal(Object.keys(row).sort(),[...fields[table]].sort()))fail('public_cohort_unreviewed_column');
    if(new Set(rows[table].map(id(table))).size!==rows[table].length)fail('public_cohort_duplicate_identity');
  }
  const sources=new Map(rows.product_source_records.map(r=>[r.id,r]));
  const batches=new Map(rows.ingestion_batches.map(r=>[r.id,r]));
  const observations=new Map(rows.product_source_observations.map(r=>[r.id,r]));
  for(const source of sources.values()) {
    if(source.source_key!=='off_api'||!eligible.some(e=>e.productId===source.product_id&&e.country===source.country&&e.externalId===source.external_id))
      fail('public_cohort_unapproved_source_identity');
    if(source.selected_observation_id!==null&&observations.get(source.selected_observation_id)?.source_record_id!==source.id)
      fail('public_cohort_selected_reference_not_closed');
    if(![...observations.values()].some(o=>o.source_record_id===source.id))fail('public_cohort_unbound_source_record');
    if(source.selected_observation_id===null&&rows.product_source_assertions.some(a=>a.source_record_id===source.id))
      fail('public_cohort_withdrawn_source_assertions');
    if(source.selected_observation_id!==null) {
      const selected=observations.get(source.selected_observation_id);
      const approved=eligible.find(e=>e.payloadHash===selected?.payload_hash&&e.productId===source.product_id&&e.country===source.country);
      if(!approved)fail('public_cohort_selected_payload_not_approved');
      checkAssertions(approved.record,rows.product_source_assertions.filter(a=>a.source_record_id===source.id));
    }
  }
  for(const observation of observations.values()) {
    const source=sources.get(observation.source_record_id),batch=batches.get(observation.batch_id);
    const approved=eligible.find(e=>e.payloadHash===observation.payload_hash&&e.productId===source?.product_id&&e.country===source?.country);
    if(!source||!batch||!approved||observation.status!=='accepted'||observation.reason!==null)fail('public_cohort_observation_not_approved');
    const record=approved.record;
    if(!equal(observation.sanitized_payload,record.sanitized_payload)||!equal(observation.extracted_fields,record.extracted_fields)||
      observation.source_url!==record.source_url||observation.license!==record.license||observation.extractor_version!==record.sanitized_payload.extractor_version||
      !equal(observation.validation_findings,record.validation_findings)||revisionNumber(observation.source_revision)!==revisionNumber(record.source_revision)||
      timestampMicros(observation.retrieved_at)!==timestampMicros(record.retrieved_at)||
      timestampMicros(observation.source_updated_at,{nullable:true})!==timestampMicros(record.source_updated_at,{nullable:true}))
      fail('public_cohort_payload_or_metadata_changed');
    timestampMicros(observation.received_at);
    if(batch.source_key!=='off_api'||batch.country!==source.country||batch.extractor_version!==record.sanitized_payload.extractor_version||
      batch.status!=='applied'||!equal(batch.scope,{category:record.identity.category,kind:'partial_upsert'}))fail('public_cohort_batch_scope_changed');
  }
  for(const batch of batches.values()) {
    timestampMicros(batch.created_at);
    const members=[...observations.values()].filter(o=>o.batch_id===batch.id);
    if(!members.length||!equal(batch.counts,{accepted:members.length}))fail('public_cohort_batch_members_not_closed');
    const member=members[0],source=sources.get(member.source_record_id);
    const approved=eligible.find(e=>e.payloadHash===member.payload_hash&&e.productId===source.product_id&&e.country===source.country);
    const pilotKey=approved.productId===178?ingestionInputs(input.pilotMutation??pilotPlan().sql.mutation)[0].idempotency_key:null;
    if(members.length!==1||![batchFor(approved).idempotency_key,pilotKey].includes(batch.idempotency_key))
      fail('public_cohort_unapproved_batch_identity');
  }
  for(const assertion of rows.product_source_assertions) {
    const observation=observations.get(assertion.observation_id);
    if(!observation||observation.source_record_id!==assertion.source_record_id||!Number.isSafeInteger(assertion.position)||assertion.position<0)
      fail('public_cohort_assertion_reference_not_closed');
    const approved=eligible.find(e=>e.payloadHash===observation.payload_hash&&e.productId===sources.get(observation.source_record_id)?.product_id);
    const record=approved.record;
    if(assertion.kind==='ingredient') {
      if(record.ingredients_state!=='reported'||!equal(record.ingredients?.[assertion.position-1],assertion.assertion))fail('public_cohort_unapproved_ingredient_assertion');
    } else if(!['contains','traces'].includes(assertion.kind)||!record.allergen_assertions.some(a=>a.type===assertion.kind&&equal(a,assertion.assertion)))
      fail('public_cohort_unapproved_allergen_assertion');
  }
}
export function proposedPublicAllowlist(rows,input) {
  verifyPublicRows(rows,input);
  const manifest={schemaVersion:1,profile:PROFILE,reviewStatus:'pending-root-review',tables:scopeTables('observations-v1'),
    allowed: Object.fromEntries(SOURCE_TABLES.map(t=>[t,rowsFingerprint(t,rows[t])])),
    sourceEvidence:rows.product_source_observations.map(o=>({id:o.id,sourceRecordId:o.source_record_id,batchId:o.batch_id,
      payloadHash:o.payload_hash,sourceUrl:o.source_url,license:o.license,extractorVersion:o.extractor_version})).sort((a,b)=>a.id.localeCompare(b.id))};
  return {...manifest,sha256:digest(manifest)};
}
export function validatePublicAllowlist(rows,manifest,reviewedSha256,input) {
  if(reviewedSha256!==manifest.sha256||!equal(proposedPublicAllowlist(rows,input),manifest))fail('public_cohort_exact_reviewed_allowlist_mismatch');
  return {result:'PASS',profile:PROFILE,manifestSha256:manifest.sha256,
    tableCount:21,sourceRows:Object.fromEntries(SOURCE_TABLES.map(t=>[t,rows[t].length])),relationalClosure:true,productionRecoveryCertified:false};
}
export async function approvedSnapshotDumpArgs(session,{manifest,reviewedSha256,archiveFile,input}) {
  // Caller must own this repeatable-read exported snapshot through pg_dump.
  const state=JSON.parse(await session.query("SELECT jsonb_build_object('readOnly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'))"));
  if(state.readOnly!=='on'||state.isolation!=='repeatable read')fail('public_cohort_read_only_snapshot_required');
  const rows=JSON.parse(await session.query(publicSnapshotSql));
  const proof=validatePublicAllowlist(rows,manifest,reviewedSha256,input);
  const snapshot=(await session.query('SELECT pg_export_snapshot()')).trim();
  if(!/^[0-9A-Fa-f-]+$/.test(snapshot))fail('public_cohort_invalid_snapshot_id');
  return {proof,args:dumpArgs(archiveFile,snapshot,'observations-v1'),snapshot,
    // This adapter does not execute pg_dump or replace existing 17-table
    // privacy gates, encryption, source hashes, restore and receipt checks.
    remainingChecks:['consumer17-privacy-gates','encrypted-archive','actual-restore-and-exact-row-hashes']};
}
