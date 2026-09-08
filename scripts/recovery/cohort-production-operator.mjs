/** Versioned, fixed-recipient production entrypoint. Default: local plan only. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {hash} from '../ci/database-release.mjs';
import {SqlSession,RecoveryError,command,readPassword,scopeTables} from './catalog-recovery.mjs';
import {operatorPlan,rollbackPlan,applyInSession,rollbackInSession,inspectOutcome,
  snapshotSql as pilotSnapshot,createEnvelopeStore,TARGET} from './cohort-pilot-operator.mjs';
import {remainingManifest,reviewSelection,retainedEntries,digest,applyReviewedBatch,rollbackOne,snapshotSql as batchSnapshot,inspectBatchOutcome} from './cohort-batch.mjs';
import {proposedPublicAllowlist,publicSnapshotSql,SOURCE_TABLES} from './cohort-public-recovery.mjs';
import {loadCombinedPublicRecovery,captureCombinedPublicRecovery,assertCombinedFreshness} from './combined-public-recovery.mjs';
import {SCHEMA_QUERIES,canonicalStructure,rolesQuery,membershipsQuery} from './schema-catalog-recovery.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const REMOTE='https://github.com/ericsocrat/tryvit.git';
const fail=code=>{throw new RecoveryError(code);};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const same=(a,b)=>digest(a)===digest(b);

export function transportEnvironment({password,caPath,readOnly=false,environment={}}) {
  if(typeof password!=='string'||!password||typeof caPath!=='string'||!path.isAbsolute(caPath))fail('production_transport_inputs_required');
  return {PATH:environment.PATH,SystemRoot:environment.SystemRoot,WINDIR:environment.WINDIR,
    PGHOST:'aws-1-eu-west-1.pooler.supabase.com',PGPORT:'5432',PGUSER:'postgres.'+TARGET,PGDATABASE:'postgres',
    PGPASSWORD:password,PGSSLMODE:'verify-full',PGSSLROOTCERT:caPath,PGCONNECT_TIMEOUT:'10',PGCLIENTENCODING:'UTF8',
    PGOPTIONS:'-c standard_conforming_strings=on'+(readOnly?' -c default_transaction_read_only=on':'')};
}

export async function verifySession(session,{readOnly=false}={}) {
  const state=JSON.parse(await session.query("SELECT jsonb_build_object('strings',current_setting('standard_conforming_strings'),'database',current_database(),'user',session_user,'readOnly',current_setting('default_transaction_read_only'))"));
  if(state.strings!=='on'||state.database!=='postgres'||state.user!=='postgres'||(readOnly&&state.readOnly!=='on'))
    fail('production_session_binding_or_sql_settings_failed');
}

function localAuthority() {
  const git=args=>command('git',args,{cwd:ROOT}).trim();
  const remote=git(['remote','get-url','origin']);
  if(![REMOTE,REMOTE.slice(0,-4),'git@github.com:ericsocrat/tryvit.git'].includes(remote))fail('production_repository_recipient_mismatch');
  const sourceHead=git(['rev-parse','HEAD']);
  let mainHead=null;try{mainHead=git(['rev-parse','refs/remotes/origin/main']);}catch{}
  const dirty=git(['status','--porcelain','--untracked-files=normal'])!=='';
  const files=fs.readdirSync(path.join(ROOT,'scripts/recovery')).filter(n=>/\.(mjs|ps1)$/.test(n)).sort();
  const code=Object.fromEntries(files.map(n=>['scripts/recovery/'+n,hash(fs.readFileSync(path.join(ROOT,'scripts/recovery',n)))]));
  for(const name of ['database-release.mjs','recovery-scopes.mjs'])code['scripts/ci/'+name]=hash(fs.readFileSync(path.join(ROOT,'scripts/ci',name)));
  return {sourceHead,mainHead,dirty,repository:'ericsocrat/tryvit',code};
}

function remoteMain() {
  const output=command('git',['-c','protocol.ext.allow=never','-c','protocol.file.allow=never','-c','http.followRedirects=false',
    'ls-remote','--exit-code',REMOTE,'refs/heads/main'],{cwd:ROOT}).trim();
  const match=output.match(/^([a-f0-9]{40})\s+refs\/heads\/main$/);
  if(!match)fail('production_remote_main_not_exact');return match[1];
}

function loadInputs(options,authority) {
  const migrationManifestSha256=hash(fs.readFileSync(path.join(ROOT,'docs/releases/evidence-first-consumer.migrations.json')));
  const binding={environment:'production',project:TARGET,sourceHead:authority.sourceHead,migrationManifestSha256,
    codeSha256:digest(authority.code),publicAllowlistSha256:options.reviewedAllowlistSha256};
  if(['inspect','rollback'].includes(options.action)) {
    const pilot=rollbackPlan(options);
    if(pilot.envelope.entry) {
      const manifest=remainingManifest(),ids=pilot.envelope.entry.batchScope?.map(e=>e.productId)??[pilot.envelope.entry.productId];
      const expected=reviewSelection(manifest,ids,options.reviewedCohortSha256).find(e=>e.productId===pilot.envelope.entry.productId);
      if(!same(expected,pilot.envelope.entry))fail('production_envelope_entry_not_reviewed');
    }
    if(options.action==='rollback'&&options.recoveryDirectory) {
      const combined=loadCombinedPublicRecovery(options.recoveryDirectory,{expectedBinding:binding});
      combined.catalogArchive.fill(0);delete combined.catalogArchive;
      pilot.proof={combined,receiptSha256:combined.receiptSha256};
    }
    return {pilot,migrationManifestSha256};
  }
  if(options.action==='inspect-sources')return {migrationManifestSha256};
  if(options.action==='capture') {
    const manifest=options.allowlistFile?JSON.parse(fs.readFileSync(options.allowlistFile)):
      proposedPublicAllowlist(Object.fromEntries(SOURCE_TABLES.map(t=>[t,[]])));
    if(options.reviewedAllowlistSha256&&options.reviewedAllowlistSha256!==manifest.sha256)fail('production_exact_public_allowlist_review_required');
    return {captureManifest:manifest,binding:{...binding,publicAllowlistSha256:manifest.sha256},migrationManifestSha256,
      captureReviewMissing:options.reviewedAllowlistSha256!==manifest.sha256};
  }
  let combinedProof=null;
  if(options.recoveryDirectory) {
    combinedProof=loadCombinedPublicRecovery(options.recoveryDirectory,{expectedBinding:binding});
    combinedProof.catalogArchive.fill(0);delete combinedProof.catalogArchive;
  }
  if(options.action==='batch') {
    const manifest=remainingManifest();
    const entries=reviewSelection(manifest,options.productIds,options.reviewedCohortSha256);
    return {manifest,entries,populatedProof:combinedProof,populatedProducerReady:true,migrationManifestSha256,
      pilotPayloadHash:retainedEntries().find(e=>e.productId===178).payloadHash};
  }
  const pilot=operatorPlan({sourceHead:options.sourceHead,target:TARGET});
  if(combinedProof) {
    if(SOURCE_TABLES.some(t=>combinedProof.sourceMetadata.fingerprints[t].count!==0))fail('production_first_pilot_requires_empty21');
    pilot.proof={combined:combinedProof,metadata:combinedProof.sourceMetadata,receiptSha256:combinedProof.receiptSha256,
      sourceFingerprints:Object.fromEntries(['schema','functions','rls'].map(kind=>[kind,
        hash(Buffer.from(JSON.stringify(kind==='schema'?canonicalStructure(combinedProof.source[kind]):combinedProof.source[kind])))]))};
  }
  return {pilot,migrationManifestSha256};
}

export function buildProductionPlan(options={},dependencies={}) {
  const action=options.action??'pilot';
  if(!['pilot','batch','inspect','rollback','capture','inspect-sources'].includes(action))fail('production_action_invalid');
  if((options.productIds&&action!=='batch')||(options.envelopeDirectory&&!['inspect','rollback'].includes(action))||
    (options.allowlistFile&&action!=='capture')||(options.recoveryDirectory&&!['pilot','batch','rollback'].includes(action)))
    fail('production_option_action_mismatch');
  if(options.target&&options.target!==TARGET)fail('production_project_mismatch');
  const authority=(dependencies.authority??localAuthority)();
  const input=(dependencies.inputs??loadInputs)({...options,action},authority);
  const caSha256=options.sourceCa?(dependencies.caHash??(file=>hash(fs.readFileSync(file))))(options.sourceCa):null;
  let blocker=null;
  if(authority.dirty||!sha(authority.sourceHead)||authority.sourceHead!==authority.mainHead)blocker='clean_versioned_current_main_required';
  if(action==='pilot'&&!input.pilot?.proof)blocker??='fresh_combined_empty21_recovery_required';
  if(action==='rollback'&&!input.pilot?.proof?.combined)blocker??='schema_bound_combined_recovery_required_for_rollback';
  if(action==='batch'&&!input.populatedProducerReady)blocker??='combined_populated21_production_producer_not_integrated';
  else if(action==='batch'&&!input.populatedProof)blocker??='fresh_combined_populated21_recovery_required';
  if(action==='batch'&&input.populatedProof?.sourceMetadata&&input.populatedProof.sourceMetadata.fingerprints.product_source_observations.count===0)
    blocker??='production_remaining_batch_requires_completed_pilot';
  if(input.captureReviewMissing)blocker??='production_exact_public_allowlist_review_required';
  if(!caSha256)blocker??='reviewed_tls_ca_required';
  const binding={schemaVersion:1,action,target:TARGET,repository:'ericsocrat/tryvit',sourceHead:authority.sourceHead,
    mainHead:authority.mainHead,codeSha256:digest(authority.code),caSha256,
    productIds:action==='batch'?input.entries.map(e=>e.productId):['capture','inspect-sources'].includes(action)?[]:[input.pilot?.envelope?.entry?.productId??178],
    inputPlanSha256:input.pilot?.planSha256??input.manifest?.sha256??input.captureManifest?.sha256??null,
    pilotPayloadHash:input.pilotPayloadHash??null,
    recoverySha256:input.pilot?.proof?.receiptSha256??input.populatedProof?.receiptSha256??null,
    migrationManifestSha256:input.migrationManifestSha256??input.pilot?.migrationManifestSha256??input.populatedProof?.migrationManifestSha256??null};
  return {summary:{...binding,planSha256:digest(binding),result:blocker?'PLAN_BLOCKED':'PLAN_READY_FOR_REVIEW',blocker,
    remoteReads:false,remoteWrites:false,localWrites:false},authority,input};
}

export function assertExecutionBindings(options,plan,current,liveMain) {
  if(plan.summary.blocker)fail(plan.summary.blocker);
  if(options.target!==TARGET||options.sourceHead!==plan.summary.sourceHead||options.mainHead!==plan.summary.mainHead||
    options.confirmDigest!==plan.summary.planSha256||current.dirty||
    current.sourceHead!==plan.summary.sourceHead||current.mainHead!==plan.summary.mainHead||
    liveMain!==plan.summary.mainHead||digest(current.code)!==plan.summary.codeSha256)
    fail('production_exact_reviewed_source_main_code_project_required');
}

async function connectProduction(options,readOnly) {
  const caPath=path.resolve(options.sourceCa);
  const env=transportEnvironment({password:readPassword(options.envFile),caPath,readOnly,environment:process.env});
  return new SqlSession('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],env);
}

function receiptFile(directory,receipt) {
  const filename=path.join(directory,'production-receipt-'+Date.now()+'.json');
  const fd=fs.openSync(filename,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(receipt,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}

export function validateDumpArguments(args) {
  const allowed=new Set(['--format=custom','--schema-only','--no-owner','--no-privileges','--no-large-objects']);
  if(!Array.isArray(args)||new Set(args).size!==args.length||!args.includes('--format=custom')||args.filter(a=>/^--snapshot=[a-fA-F0-9-]+$/.test(a)).length!==1||
    args.some(a=>!allowed.has(a)&&!/^--snapshot=[a-fA-F0-9-]+$/.test(a)&&!scopeTables('observations-v1').some(t=>a==='--table=public.'+t)))
    fail('production_dump_arguments_not_scoped');
  const tables=args.filter(a=>a.startsWith('--table='));
  if(args.includes('--schema-only')?tables.length!==0:!same(tables.sort(),scopeTables('observations-v1').map(t=>'--table=public.'+t).sort()))
    fail('production_dump_scope_incomplete');
}

function productionCaptureTransport(options) {
  return {identity:async()=>({environment:'production',project:TARGET}),
    openSession:async()=>{const s=await connectProduction(options,true);try{await verifySession(s,{readOnly:true});return s;}catch(e){await s.close().catch(()=>{});throw e;}},
    pgDump:async args=>{
      const env=transportEnvironment({password:readPassword(options.envFile),caPath:path.resolve(options.sourceCa),readOnly:true,environment:process.env});
      return executeScopedDump(args,env);
    }};
}

export function executeScopedDump(args,env,spawn=spawnSync) {
  validateDumpArguments(args);
  let result;
  try {
    result=spawn('pg_dump',args,{env:{...env,PGOPTIONS:(env.PGOPTIONS??'')+' -c statement_timeout=120000'},
      encoding:null,maxBuffer:64*1024*1024,timeout:120000,windowsHide:true,shell:false});
  } catch {fail('production_scoped_dump_failed');}
  if(result.error||result.status!==0||!Buffer.isBuffer(result.stdout)) {
    for(const value of [result.stdout,result.stderr,...(result.output??[])])if(Buffer.isBuffer(value))value.fill(0);
    fail('production_scoped_dump_failed');
  }
  if(Buffer.isBuffer(result.stderr))result.stderr.fill(0);
  return result.stdout;
}

async function structureFreshness(session,proof) {
  for(const [kind,query] of Object.entries(SCHEMA_QUERIES))if(!same(JSON.parse(await session.query(query)),proof.source[kind]))fail('production_batch_schema_drift');
  if(!same(JSON.parse(await session.query(rolesQuery)),proof.roles)||!same(JSON.parse(await session.query(membershipsQuery)),proof.memberships))fail('production_batch_roles_drift');
}

async function runProductionBatch(options,plan,dependencies) {
  const proof=plan.input.populatedProof,stores=[];
  const connect=async()=>{
    const session=await (dependencies.connect??connectProduction)(options,false);
    try{await verifySession(session);return session;}catch(error){await session.close().catch(()=>{});throw error;}
  };
  const executionPlan={planSha256:plan.summary.planSha256,sourceHead:plan.summary.sourceHead,executionEnvironment:'production'};
  let result;
  try {result=await (dependencies.applyBatch??applyReviewedBatch)({manifest:plan.input.manifest,productIds:plan.summary.productIds,
    confirmedSha256:plan.input.manifest.sha256,connect,
    verifyRecovery:async(session,{index})=>{
      if(index===0)await assertCombinedFreshness(session,proof);else await structureFreshness(session,proof);
      if(!/^[a-f0-9]{64}$/.test(plan.input.pilotPayloadHash??''))fail('production_pilot_payload_binding_required');
      const selected=await session.query("SELECT EXISTS(SELECT 1 FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id "+
        "WHERE r.product_id=178 AND r.source_key='off_api' AND r.country='PL' AND r.external_id='5900340003615' AND o.status='accepted' AND o.payload_hash='"+plan.input.pilotPayloadHash+"')");
      if(selected.trim()!=='t')fail('production_remaining_batch_requires_completed_pilot');
    },
    storeFor:entry=>{
      const store=(dependencies.store??createEnvelopeStore)({...executionPlan,artifactKind:'cohort-batch-'+entry.productId});
      stores.push({productId:entry.productId,directory:store.directory});return store;
    }});}
  catch(error) {
    const classified=error instanceof RecoveryError?error:new RecoveryError('production_batch_failed_inspect_envelopes_no_retry');
    classified.envelopeDirectories=stores.map(s=>path.relative(ROOT,s.directory));throw classified;
  }
  const uncertain=result.results?.some(r=>/uncertain/.test(r.code??''));
  const receipt={...result,sourceHead:plan.summary.sourceHead,mainHead:plan.summary.mainHead,planSha256:plan.summary.planSha256,
    codeSha256:plan.summary.codeSha256,target:TARGET,remoteExecutionImplemented:true,remoteReads:true,remoteWrites:uncertain?null:result.results?.some(r=>r.result==='APPLIED')??false,
    writeDisposition:uncertain?'UNKNOWN_RECONCILE_NO_RETRY':'REPORTED_PER_MEMBER',
    envelopes:stores.map(s=>({productId:s.productId,directory:path.relative(ROOT,s.directory)}))};
  if(stores.length)try{(dependencies.receipt??receiptFile)(stores[0].directory,receipt);}catch{
    const error=new RecoveryError('production_batch_receipt_failed_inspect_envelopes_no_retry');
    error.envelopeDirectories=stores.map(s=>path.relative(ROOT,s.directory));throw error;
  }
  return receipt;
}

export async function productionOperate(options={},dependencies={}) {
  const plan=buildProductionPlan(options,dependencies);
  if(!options.execute)return plan.summary;
  // All local blockers precede credentials, network calls and envelope writes.
  if(plan.summary.blocker)fail(plan.summary.blocker);
  const current=(dependencies.authority??localAuthority)();
  const liveMain=await (dependencies.remoteMain??remoteMain)();
  assertExecutionBindings(options,plan,current,liveMain);
  const fresh=buildProductionPlan(options,dependencies);
  if(!same(fresh.summary,plan.summary))fail('production_plan_inputs_changed');
  const action=plan.summary.action,readOnly=['inspect','inspect-sources'].includes(action);
  if(action==='capture') {
    const captured=await (dependencies.capture??captureCombinedPublicRecovery)({transport:(dependencies.captureTransport??productionCaptureTransport)(options),
      manifest:plan.input.captureManifest,reviewedSha256:plan.input.binding.publicAllowlistSha256,binding:plan.input.binding});
    return {...captured,planSha256:plan.summary.planSha256,mainHead:liveMain,remoteReads:true,remoteWrites:false,localWrites:true};
  }
  if(action==='batch')return runProductionBatch(options,plan,dependencies);
  const session=await (dependencies.connect??connectProduction)(options,readOnly);
  let store;
  try {
    // Injected test transports must meet the same SQL session contract.
    await verifySession(session,{readOnly});
    const original=plan.input.pilot;
    let result;
    if(action==='inspect-sources') {
      await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const manifest=proposedPublicAllowlist(JSON.parse(await session.query(publicSnapshotSql)));
      return {...plan.summary,result:'PUBLIC_ALLOWLIST_PROPOSAL',manifest,remoteReads:true,remoteWrites:false,localWrites:false};
    }
    if(readOnly) {
      await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const entry=original.envelope.entry,currentTarget=JSON.parse(await session.query(entry?batchSnapshot(entry):pilotSnapshot));
      const result=entry?inspectBatchOutcome(original.envelope,currentTarget):
        inspectOutcome(original.envelope,currentTarget);
      return {...plan.summary,result,blocker:null,remoteReads:true,remoteWrites:false};
    }
    const executionPlan={...original,sourceHead:plan.summary.sourceHead,planSha256:plan.summary.planSha256,executionEnvironment:'production',
      artifactKind:original.envelope?.entry?'cohort-batch-'+original.envelope.entry.productId:'pilot178',
      ...(original.proof?.combined?{verifyRecovery:s=>assertCombinedFreshness(s,original.proof.combined)}:{})};
    store=(dependencies.store??createEnvelopeStore)(executionPlan);
    if(action==='pilot')result=await (dependencies.applyPilot??applyInSession)(session,executionPlan,store);
    else {
      const entry=original.envelope.entry;
      const beforeHash=store.save('before',{...(entry?{entry}:{}),before:original.envelope.before});
      store.save('after',{...(entry?{entry}:{}),before:original.envelope.before,after:original.envelope.after,beforeEncryptedSha256:beforeHash});
      const verification={verifyRecovery:s=>structureFreshness(s,original.proof.combined)};
      result=entry?await (dependencies.rollbackBatch??rollbackOne)(session,original.envelope,store,verification):
        await (dependencies.rollbackPilot??rollbackInSession)(session,original.envelope,value=>store.save('reversal',value),verification);
    }
    const receipt={...result,sourceHead:plan.summary.sourceHead,mainHead:liveMain,planSha256:plan.summary.planSha256,
      codeSha256:plan.summary.codeSha256,target:TARGET,checkedAt:new Date().toISOString()};
    try{(dependencies.receipt??receiptFile)(store.directory,receipt);}
    catch{fail('production_committed_receipt_failed_inspect_envelope_no_retry');}
    return {...receipt,envelopeDirectory:path.relative(ROOT,store.directory)};
  } catch(error) {
    if(store?.directory&&error instanceof RecoveryError)error.envelopeDirectory=path.relative(ROOT,store.directory);
    throw error;
  } finally {store?.close();await session.close().catch(()=>{});}
}

export function parseOptions(args) {
  const names={'--action':'action','--project':'target','--source-head':'sourceHead','--main-sha':'mainHead',
    '--confirm-sha256':'confirmDigest','--source-ca':'sourceCa','--source-env-file':'envFile',
    '--recovery-directory':'recoveryDirectory','--envelope-directory':'envelopeDirectory','--allowlist-file':'allowlistFile',
    '--reviewed-allowlist-sha256':'reviewedAllowlistSha256','--ids':'productIds','--reviewed-cohort-sha256':'reviewedCohortSha256'};
  const result={},seen=new Set();
  for(let i=0;i<args.length;i++) {
    const flag=args[i];if(seen.has(flag))fail('production_duplicate_option');seen.add(flag);
    if(flag==='--execute'){result.execute=true;continue;}
    if(!Object.hasOwn(names,flag)||!args[i+1]||args[i+1].startsWith('--'))fail('production_unknown_or_missing_option');
    result[names[flag]]=args[++i];
  }
  if(result.productIds) {
    if(result.action!=='batch')fail('production_option_action_mismatch');
    if(!/^\d+(,\d+){0,4}$/.test(result.productIds))fail('production_batch_ids_invalid');
    result.productIds=result.productIds.split(',').map(Number);
    if(new Set(result.productIds).size!==result.productIds.length||result.productIds.some(id=>!Number.isSafeInteger(id)||id<1))fail('production_batch_ids_invalid');
  }
  return result;
}

export function operatorExitCode(result,{execute=false}={}) {
  // A fulfilled per-member batch can still contain partial or uncertain writes.
  // Keep its receipt intact, but never report that disposition as CLI success.
  if(!execute)return 0;
  return ['PASS','APPLIED','REVERSED','PUBLIC_ALLOWLIST_PROPOSAL',
    'APPLIED_MATCHING_POSTIMAGE','NOT_APPLIED_MATCHING_PREIMAGE','REVERSED_MATCHING_BASELINE']
    .includes(result?.result)&&result?.writeDisposition!=='UNKNOWN_RECONCILE_NO_RETRY'?0:1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let options;
  Promise.resolve().then(()=>{options=parseOptions(process.argv.slice(2));return productionOperate(options);})
    .then(result=>{console.log(JSON.stringify(result));process.exitCode=operatorExitCode(result,options);})
    .catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'production_operator_failed',
      ...(error instanceof RecoveryError&&error.envelopeDirectory?{envelopeDirectory:error.envelopeDirectory}:{}),
      ...(error instanceof RecoveryError&&error.envelopeDirectories?{envelopeDirectories:error.envelopeDirectories}:{})}));process.exitCode=1;});
}
