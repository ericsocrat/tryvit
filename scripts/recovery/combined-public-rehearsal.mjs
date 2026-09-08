/** Local contained-clone integration only; never constructs remote credentials. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {runBatchRehearsal} from './cohort-batch-rehearsal.mjs';
import {captureCombinedPublicRecovery,loadCombinedPublicRecovery,assertCombinedFreshness} from './combined-public-recovery.mjs';
import {publicSnapshotSql,proposedPublicAllowlist} from './cohort-public-recovery.mjs';
import {assertContained} from './opaque-containment.mjs';
import {SCHEMA_QUERIES,rolesQuery,membershipsQuery} from './schema-catalog-recovery.mjs';
import {ROOT,digest,fail,equal} from './cohort-batch.mjs';
const sources=['combined-public-recovery.mjs','schema-catalog-recovery.mjs','catalog-recovery.mjs','cohort-public-recovery.mjs'];
const codeSha256=digest(Object.fromEntries(sources.map(f=>[f,digest(fs.readFileSync(path.join(ROOT,'scripts/recovery',f)).toString('utf8'))])));
const capture=async({name,connect,sourceHead,manifestSha256})=>{
    const inspect=()=>{const r=spawnSync('docker',['inspect',name],{encoding:'utf8'});if(r.status!==0)fail('combined_clone_inspection_failed');assertContained(JSON.parse(r.stdout)[0]);};
    inspect();const session=connect();let manifest;
    try{await session.query('BEGIN READ ONLY');manifest=proposedPublicAllowlist(JSON.parse(await session.query(publicSnapshotSql)));}finally{await session.close();}
    const binding={environment:'isolated-clone',project:name,sourceHead,migrationManifestSha256:manifestSha256,codeSha256,publicAllowlistSha256:manifest.sha256};
    const captured=await captureCombinedPublicRecovery({binding,manifest,reviewedSha256:manifest.sha256,transport:{
      identity:async()=>{inspect();return {environment:'isolated-clone',project:name};},openSession:async()=>connect(),
      pgDump:async args=>{inspect();const r=spawnSync('docker',['exec',name,'pg_dump','-h','/tmp','-U','postgres','-d','postgres',...args],
        {encoding:null,maxBuffer:64*1024*1024});if(r.status!==0)fail('combined_clone_dump_failed');return r.stdout;},
    }});
    const proof=loadCombinedPublicRecovery(captured.directory,{expectedBinding:binding});
    try {
      const check=connect();try{await check.query('BEGIN READ ONLY');await assertCombinedFreshness(check,proof);}finally{await check.close();}
      let productionRejected=false;try{loadCombinedPublicRecovery(captured.directory,{expectedBinding:{...binding,environment:'production',project:'uskvezwftkkudvksmken'}});}catch{productionRejected=true;}
      if(!productionRejected)fail('combined_clone_proof_accepted_as_production');
      return {...captured,receiptSha256:proof.receiptSha256,freshnessVerified:true,productionBindingRejected:true};
    }finally{proof.catalogArchive.fill(0);}
  };
const result=await runBatchRehearsal({catalogDirectory:path.join(ROOT,'backups/tryvit_catalog_restore_1788858519462_6e160c'),
  schemaDirectory:path.join(ROOT,'backups/schema_catalog_1788858898737_1f8170'),
  databaseAuthorityPath:'audit-reports/recovery/consumer-database-authority-20260908.json',execute:true,
  onEmpty:process.argv.includes('--empty-first')?capture:null,onPopulated:capture,
  verifyCapturedRecovery:process.argv.includes('--empty-first')?async(session,{index,operation,emptyCombinedRecovery})=>{
    const state=JSON.parse(await session.query("SELECT jsonb_build_object('isolation',current_setting('transaction_isolation'),'transaction',txid_current_if_assigned() IS NOT NULL)"));
    if(state.isolation!=='repeatable read'||state.transaction!==true)fail('combined_apply_verification_outside_locked_transaction');
    const proof=loadCombinedPublicRecovery(emptyCombinedRecovery.directory,{expectedBinding:emptyCombinedRecovery.binding});
    try {
      if(index===0&&operation==='apply')await assertCombinedFreshness(session,proof);
      else {
        for(const [kind,query] of Object.entries(SCHEMA_QUERIES))if(!equal(JSON.parse(await session.query(query)),proof.source[kind]))fail('combined_member_schema_drift');
        if(!equal(JSON.parse(await session.query(rolesQuery)),proof.roles)||!equal(JSON.parse(await session.query(membershipsQuery)),proof.memberships))fail('combined_member_roles_drift');
      }
      return {result:'PASS',scope:index===0&&operation==='apply'?'all21-and-structure':'structure-and-roles',insideLockedTransaction:true};
    }finally{proof.catalogArchive.fill(0);}
  }:null});
console.log(JSON.stringify({result:result.result,receipt:result.receipt,combined:result.integration?.combinedRecovery,
  emptyCombined:result.integration?.emptyCombinedRecovery,recoveryChecks:result.integration?.recoveryChecks,remoteReads:false,remoteWrites:false}));
