/** Real-clone batch exercise; no remote reads/writes and no production receipt. */
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ROOT,remainingManifest,reviewSelection,applyOne,rollbackOne,snapshotSql,equal,fail,digest,verifyBatchPostimages,changedPaths,targetSnapshot} from './cohort-batch.mjs';
import {batchEnvelopeStore,readBatchEnvelope} from './cohort-batch-envelopes.mjs';
import {publicSnapshotSql,proposedPublicAllowlist,validatePublicAllowlist,approvedSnapshotDumpArgs} from './cohort-public-recovery.mjs';
import {schemaCatalogRecovery} from './schema-catalog-recovery.mjs';
import {SqlSession,command,RecoveryError} from './catalog-recovery.mjs';
import {assertContained} from './opaque-containment.mjs';
import {pilotPlan} from './cohort-pilot.mjs';
import {hash} from '../ci/database-release.mjs';
import {populatedCloneArchive} from './cohort-populated-clone-archive.mjs';


function locate(context) {
  const marker=randomBytes(16).toString('hex');
  context.sqlAsPostgres(`CREATE SCHEMA recovery_cohort_batch; COMMENT ON SCHEMA recovery_cohort_batch IS '${marker}';`,'batch_marker');
  const names=command('docker',['ps','--filter','label=tryvit.recovery.scope=containment-probe','--format','{{.Names}}']).trim().split(/\r?\n/).filter(Boolean);
  if(names.length>8)fail('batch_clone_inventory_unbounded');
  const matches=names.filter(name=>{
    if(!/^tryvit_recovery_probe_[a-f0-9]{12}$/.test(name))fail('batch_clone_name_invalid');
    assertContained(JSON.parse(command('docker',['inspect',name]))[0]);
    return command('docker',['exec',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-c',
      "SELECT COALESCE(obj_description(oid,'pg_namespace'),'') FROM pg_namespace WHERE nspname='recovery_cohort_batch'"]).trim()===marker;
  });
  if(matches.length!==1)fail('batch_clone_marker_not_unique');return matches[0];
}
function connect(name) {
  assertContained(JSON.parse(command('docker',['inspect',name]))[0]);
  return new SqlSession('docker',['exec','-i',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],
    {PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR});
}
export async function runBatchRehearsal({catalogDirectory,schemaDirectory,databaseAuthorityPath,execute=false,all54=false,retainSelected=false,productIds=null,onPopulated=null,onEmpty=null,verifyCapturedRecovery=null}) {
  const manifest=remainingManifest(),pilot=pilotPlan();
  if(retainSelected&&!all54)fail('batch_retain_requires_full_cohort');
  if(productIds&&all54)fail('batch_ambiguous_selection');
  const selectedIds=productIds??(all54?manifest.entries.map(e=>e.productId):[manifest.entries.find(e=>e.decision==='unchanged-candidate').productId,
    manifest.entries.find(e=>e.decision!=='unchanged-candidate'&&e.country==='PL').productId,
    manifest.entries.find(e=>e.decision!=='unchanged-candidate'&&e.country==='DE').productId]);
  const sourceHead=command('git',['rev-parse','HEAD'],{cwd:ROOT}).trim();
  const sources=['cohort-batch.mjs','cohort-public-recovery.mjs','cohort-batch-envelopes.mjs','cohort-batch-rehearsal.mjs','cohort-populated-clone-archive.mjs','cohort-pilot-operator.mjs','catalog-recovery.mjs','opaque-containment.mjs','schema-catalog-recovery.mjs'];
  const sourceHashes=Object.fromEntries(sources.map(f=>[f,hash(fs.readFileSync(path.join(ROOT,'scripts/recovery',f)))]));
  if(!execute)return {result:'PLAN',sourceHead,selectedIds,manifestSha256:manifest.sha256,remoteReads:false,remoteWrites:false};
  const authority=JSON.parse(fs.readFileSync(path.resolve(ROOT,databaseAuthorityPath)));
  const result=await schemaCatalogRecovery({catalogDirectory:path.resolve(ROOT,catalogDirectory),schemaDirectory:path.resolve(ROOT,schemaDirectory),
    manifestSha256:pilot.manifestSha256,scopeProfile:'consumer-v1',execute:true,writeReceipt:false,cloneLifetimeSeconds:all54?1200:300,
    onVerifiedRestore:async context=>{
      if(!Object.values(context.restoreDatabaseAuthority(authority)).every(v=>v===true))fail('batch_clone_authority_mismatch');
      for(const entry of pilot.manifest.migrations){const bytes=fs.readFileSync(path.join(ROOT,entry.path));if(hash(bytes)!==entry.sha256)fail('batch_migration_changed');context.sqlAsPostgres(bytes.toString('utf8'),'batch_migration');}
      const name=locate(context),applied=[],reversed=[],batches=[],allEnvelopes=[],peerChecks=[];
      const emptyCombinedRecovery=onEmpty?await onEmpty({name,connect:()=>connect(name),sourceHead,manifestSha256:pilot.manifestSha256}):null;
      const recoveryChecks=[];
      const verification=(index,operation)=>verifyCapturedRecovery?{verifyRecovery:async session=>{
        const checked=await verifyCapturedRecovery(session,{index,operation,emptyCombinedRecovery});
        recoveryChecks.push({index,operation,...checked});
      }}:{};
      async function reverse(envelopes) {
        for(const envelope of envelopes.toReversed()) {
          const session=connect(name),store=batchEnvelopeStore(envelope.entry,manifest.sha256);
          try {
            reversed.push(await rollbackOne(session,envelope,store,verification(-1,'rollback')));
            readBatchEnvelope(store.directory,'reversal');
            let refused=false;try{await applyOne(session,envelope.entry,store);}catch(error){refused=error.code==='cohort_withdrawn_or_old_duplicate_requires_selection_review';}
            if(!refused)fail('batch_withdrawn_selection_reactivated');
          } finally {store.close();await session.close().catch(()=>{});}
        }
      }
      for(let offset=0;offset<selectedIds.length;offset+=5) {
      const selected=reviewSelection(manifest,selectedIds.slice(offset,offset+5),manifest.sha256),envelopes=[];
      batches.push(selected.map(e=>e.productId));
      for(const entry of selected) {
        const session=connect(name),store=batchEnvelopeStore(entry,manifest.sha256);
        try {
          applied.push(await applyOne(session,entry,store,verification(applied.length,'apply')));
          const envelope=readBatchEnvelope(store.directory,'after');envelopes.push(envelope);
          const first=JSON.parse(await session.query(snapshotSql(entry)));
          if([943,1036].includes(entry.productId)) {
            const alternatives=[];
            for(const setting of ['enable_seqscan=off','enable_indexscan=off; SET LOCAL enable_bitmapscan=off']) {
              await session.query('BEGIN READ ONLY; SET LOCAL '+setting);
              const alternative=JSON.parse(await session.query(snapshotSql(entry)));
              await session.query('ROLLBACK');
              alternatives.push({setting,changes:changedPaths(first,alternative)});
            }
            fs.writeFileSync(path.join(ROOT,'audit-reports/recovery','cohort-read-plan-'+entry.productId+'-'+Date.now()+'.json'),JSON.stringify({productId:entry.productId,sourceHashes,alternatives,remoteReads:false,remoteWrites:false},null,2));
          }
          const duplicate=await applyOne(session,entry,store,verification(-1,'duplicate'));
          const second=JSON.parse(await session.query(snapshotSql(entry)));
          if(duplicate.result!=='ALREADY_SELECTED_NO_WRITE'||!equal(first,second)) {
            const changes=Object.keys(first).filter(k=>!equal(first[k],second[k])).map(k=>({field:k,beforeSha256:digest(first[k]),afterSha256:digest(second[k])}));
            fs.writeFileSync(path.join(ROOT,'audit-reports/recovery','cohort-idempotency-failure-'+Date.now()+'.json'),JSON.stringify({productId:entry.productId,sourceHashes,changes,changedPaths:changedPaths(first,second),remoteReads:false,remoteWrites:false},null,2));
            fail('batch_idempotency_changed_state');
          }
        } finally {store.close();await session.close().catch(()=>{});}
      }
      try {peerChecks.push(await verifyBatchPostimages(()=>connect(name),envelopes));}
      catch(error) {
        if(error.diagnostics)fs.writeFileSync(path.join(ROOT,'audit-reports/recovery','cohort-peer-failure-'+Date.now()+'.json'),JSON.stringify({sourceHashes,...error.diagnostics,remoteReads:false,remoteWrites:false},null,2));
        throw error;
      }
      allEnvelopes.push(...envelopes);
      }
      const session=connect(name);let allowlistProof,populatedArchive;
      try {
        await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const rows=JSON.parse(await session.query(publicSnapshotSql)),allowlist=proposedPublicAllowlist(rows);
        allowlistProof=validatePublicAllowlist(rows,allowlist,allowlist.sha256);
        const adapter=await approvedSnapshotDumpArgs(session,{manifest:allowlist,reviewedSha256:allowlist.sha256,archiveFile:'/tmp/not-executed.dump'});
        if(adapter.args.filter(a=>a.startsWith('--table=')).length!==21)fail('batch_populated_dump_scope_wrong');
        for(const mutate of [r=>r.product_source_observations[0].source_url='https://unapproved.example/',
          r=>r.product_source_records[0].selected_observation_id='00000000-0000-4000-8000-000000000000',
          r=>r.ingestion_batches[0].idempotency_key='unexpected-private-value']) {
          const bad=structuredClone(rows);mutate(bad);let rejected=false;try{validatePublicAllowlist(bad,allowlist,allowlist.sha256);}catch{rejected=true;}
          if(!rejected)fail('batch_populated_adversarial_row_accepted');
        }
        populatedArchive=await populatedCloneArchive(name,session,adapter);
      } finally {await session.close().catch(()=>{});}
      const combinedRecovery=onPopulated?await onPopulated({name,connect:()=>connect(name),sourceHead,manifestSha256:pilot.manifestSha256}):null;
      let originalGlobalCasRejectedLaterBatches=false;
      if(all54) {
        const probe=connect(name);
        try {
          const now=JSON.parse(await probe.query(snapshotSql(allEnvelopes[0].entry)));
          originalGlobalCasRejectedLaterBatches=equal(targetSnapshot(now),targetSnapshot(allEnvelopes[0].after))&&!equal(now.unaffected,allEnvelopes[0].after.unaffected);
          if(!originalGlobalCasRejectedLaterBatches)fail('batch_old_global_cas_gap_not_reproduced');
        } finally {await probe.close();}
      }
      if(!retainSelected)await reverse(allEnvelopes);
      return {result:'PASS',applied,reversed,batches,peerChecks,idempotencyNoWrite:true,withdrawnSelectionNotReactivated:!retainSelected,
        originalGlobalCasRejectedLaterBatches,allowlistProof,populatedArchive,combinedRecovery,emptyCombinedRecovery,recoveryChecks,populatedArchiveExecuted:true,productionReviewGranted:false,productionRecoveryCertified:false};
    }});
  for(const file of sources)if(hash(fs.readFileSync(path.join(ROOT,'scripts/recovery',file)))!==sourceHashes[file])fail('batch_source_changed_during_rehearsal');
  const report={schemaVersion:1,method:'real-restored-clone-retained-small-batch-and-public-allowlist',sourceHead,sourceHashes,
    reviewedFor:'local-rehearsal-only',manifestSha256:manifest.sha256,migrationManifestSha256:pilot.manifestSha256,selectedIds,all54,retainSelected,remoteReads:false,remoteWrites:false,...result};
  const output=path.join(ROOT,'audit-reports/recovery','cohort-batch-rehearsal-'+Date.now()+'.json');
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');return {...report,receipt:path.relative(ROOT,output)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),v=f=>{const i=args.indexOf(f);return i<0?null:args[i+1];};
  runBatchRehearsal({catalogDirectory:v('--catalog-directory'),schemaDirectory:v('--schema-directory'),databaseAuthorityPath:v('--database-authority'),execute:args.includes('--execute'),all54:args.includes('--all54'),retainSelected:args.includes('--retain-selected'),productIds:v('--product-ids')?.split(',').map(Number)})
    .then(r=>console.log(JSON.stringify(r))).catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'batch_rehearsal_failed'}));process.exitCode=1;});
}
