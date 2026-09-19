/** Versioned source-expansion manifest adapter; no production transport. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash} from '../ci/database-release.mjs';
import {RecoveryError} from './catalog-recovery.mjs';
import {applyOne,batchFor,digest,equal,snapshotSql,verifyBatchPostimages} from './cohort-batch.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const PROFILE='source-expansion-cohort-v1';
const fail=code=>{throw new RecoveryError(code);};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);

export function semanticManifestSha256(manifest) {
  const {manifestSha256,...body}=manifest;
  return hash(Buffer.from(JSON.stringify((function stable(value) {
    return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?
      Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
  })(body))+'\n'));
}

export function loadExpansionManifest(file,confirmedFileSha256,{root=ROOT,readFile=fs.readFileSync}={}) {
  const allowed=path.join(path.resolve(root),'audit-reports','source-expansion')+path.sep;
  const resolved=path.resolve(file);
  if(!resolved.startsWith(allowed)||path.basename(resolved)!=='release-manifest.json')fail('expansion_manifest_path_invalid');
  const bytes=readFile(resolved);
  if(!sha(confirmedFileSha256)||hash(bytes)!==confirmedFileSha256)fail('expansion_exact_manifest_review_required');
  let manifest;try{manifest=JSON.parse(bytes);}catch{fail('expansion_manifest_invalid');}
  if(manifest.schemaVersion!==1||manifest.profile!==PROFILE||manifest.selectedCount!==150||
    !sha(manifest.selectionSha256)||!sha(manifest.acquisitionReceiptSha256)||!sha(manifest.acquisitionManifestSha256)||
    !sha(manifest.productionIdentityReviewSha256)||typeof manifest.productionCheckedAt!=='string'||
    manifest.activeProductsAtReview!==2434||manifest.selectedSourcesBefore!==55||!sha(manifest.manifestSha256)||
    manifest.manifestSha256!==semanticManifestSha256(manifest)||!Array.isArray(manifest.entries)||
    !Array.isArray(manifest.held)||!Array.isArray(manifest.notFound)||!Array.isArray(manifest.fetchFailed)||
    manifest.entries.length+manifest.held.length+manifest.notFound.length+manifest.fetchFailed.length!==150)
    fail('expansion_manifest_invalid');
  const ids=[...manifest.entries,...manifest.held,...manifest.notFound,...manifest.fetchFailed].map(entry=>entry.productId);
  if(new Set(ids).size!==150||ids.some(id=>!Number.isSafeInteger(id)||id<1))fail('expansion_manifest_members_invalid');
  const recordRoot=path.dirname(resolved);
  const entries=manifest.entries.map(entry=>{
    if(entry.country!=='PL'||entry.batchProfile!=='source-expansion-v1'||path.basename(entry.recordFile)!==entry.recordFile||
      !sha(entry.recordSha256)||!sha(entry.payloadHash)||entry.extractorVersion!=='off-observations-v2'||
      !equal(entry.beforeAttributes,entry.afterAttributes))fail('expansion_entry_invalid');
    const recordBytes=readFile(path.join(recordRoot,entry.recordFile));
    if(hash(recordBytes)!==entry.recordSha256)fail('expansion_record_hash_changed');
    let record;try{record=JSON.parse(recordBytes);}catch{fail('expansion_record_invalid');}
    if(record.payload_hash!==entry.payloadHash||record.sanitized_payload?.extractor_version!==entry.extractorVersion||
      hash(Buffer.from(record.payload_canonical))!==entry.payloadHash||
      !equal(JSON.parse(record.payload_canonical),record.sanitized_payload)||record.external_id!==entry.externalId||
      !equal(record.identity,{...entry.afterAttributes,ean:entry.externalId}))fail('expansion_record_binding_changed');
    return {...entry,record};
  });
  return {...manifest,entries,fileSha256:confirmedFileSha256,recordRoot};
}

export function reviewExpansionSelection(manifest,ids,confirmedFileSha256) {
  if(manifest.fileSha256!==confirmedFileSha256||!Array.isArray(ids)||ids.length<1||ids.length>150||new Set(ids).size!==ids.length)
    fail('expansion_batch_size_or_review_invalid');
  const selected=ids.map(id=>{
    const entry=manifest.entries.find(candidate=>candidate.productId===id);
    if(!entry)fail('expansion_unreviewed_or_held_member');return entry;
  }).sort((a,b)=>a.externalId.localeCompare(b.externalId));
  return selected.map((entry,index)=>{
    const batch=selected.slice(Math.floor(index/5)*5,Math.floor(index/5)*5+5);
    const batchScope=batch.map(member=>({productId:member.productId,country:member.country,externalId:member.externalId,
      idempotencyKey:batchFor(member).idempotency_key}));
    return {...entry,batchScope};
  });
}

export async function applyExpansionBatch({manifest,productIds,confirmedSha256,connect,storeFor,verifyRecovery}) {
  const selected=reviewExpansionSelection(manifest,productIds,confirmedSha256),results=[],postimages=[],batches=[],peerPostimages=[];
  for(let offset=0,halt=false;offset<selected.length&&!halt;offset+=5) {
    const batch=selected.slice(offset,offset+5),batchPostimages=[];batches.push(batch.map(entry=>entry.productId));
    for(const entry of batch) {
      const session=await connect(),store=storeFor(entry);
      try {
        results.push(await applyOne(session,entry,{...store,save(stage,value){
          const receipt=store.save(stage,value);if(stage==='after') {
            const postimage={entry,after:value.after};postimages.push(postimage);batchPostimages.push(postimage);
          } return receipt;
        }},{verifyRecovery:verifyRecovery?current=>verifyRecovery(current,{index:results.length,entry}):undefined}));
        if(results.at(-1).result==='ALREADY_SELECTED_NO_WRITE') {
          const postimage={entry,after:JSON.parse(await session.query(snapshotSql(entry)))};
          postimages.push(postimage);batchPostimages.push(postimage);
        }
      } catch(error) {
        results.push({result:'HOLD',productId:entry.productId,code:error instanceof RecoveryError?error.code:'expansion_batch_failure'});
        halt=true;break;
      } finally {store.close?.();await session.close();}
    }
    try {if(batchPostimages.length) {
      peerPostimages.push({batch:await verifyBatchPostimages(connect,batchPostimages),release:await verifyBatchPostimages(connect,postimages)});
    }} catch(error) {
      results.push({result:'HOLD',code:error instanceof RecoveryError?error.code:'expansion_batch_peer_check_failed'});break;
    }
  }
  const pass=results.length===selected.length&&!results.some(result=>result.result==='HOLD')&&
    peerPostimages.every(proof=>proof.batch.result==='PASS'&&proof.release.result==='PASS');
  return {result:pass?'PASS':'HOLD',results,batches,peerPostimages,
    remainingNotAttempted:selected.slice(results.filter(result=>result.productId).length).map(entry=>entry.productId),remoteExecutionImplemented:false};
}
