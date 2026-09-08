/** Real retained clone + persistent psql + disk/DPAPI boundary. No remote path. */
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {hash} from '../ci/database-release.mjs';
import {SqlSession,RecoveryError,command,scopeTables,fingerprintQuery,assertEmptyObservations} from './catalog-recovery.mjs';
import {schemaCatalogRecovery,SCHEMA_QUERIES,canonicalStructure} from './schema-catalog-recovery.mjs';
import {assertContained,dpapi,decryptBytes} from './opaque-containment.mjs';
import {pilotPlan} from './cohort-pilot.mjs';
import {applyInSession,rollbackInSession,snapshotSql,inspectOutcome,createEnvelopeStore,loadEnvelope} from './cohort-pilot-operator.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const check=(ok,code)=>{if(!ok)throw new RecoveryError(code);};

function markedContainer(context,marker) {
  context.sqlAsPostgres(`CREATE SCHEMA recovery_operator_probe; COMMENT ON SCHEMA recovery_operator_probe IS '${marker}';`,'operator_marker');
  const names=command('docker',['ps','--filter','label=tryvit.recovery.scope=containment-probe','--format','{{.Names}}'])
    .trim().split(/\r?\n/).filter(Boolean);
  check(names.length>0&&names.length<=8,'operator_clone_inventory_unbounded');
  const matches=[];
  for(const name of names) {
    check(/^tryvit_recovery_probe_[a-f0-9]{12}$/.test(name),'operator_clone_name_invalid');
    const state=JSON.parse(command('docker',['inspect',name]))[0];assertContained(state);
    const value=command('docker',['exec',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-c',
      "SELECT COALESCE(obj_description(oid,'pg_namespace'),'') FROM pg_namespace WHERE nspname='recovery_operator_probe'"]);
    if(value.trim()===marker)matches.push(name);
  }
  check(matches.length===1,'operator_clone_marker_not_unique');
  return matches[0];
}
function connect(name) {
  assertContained(JSON.parse(command('docker',['inspect',name]))[0]);
  return new SqlSession('docker',['exec','-i',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt',
    '-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR});
}
async function freshSnapshot(name) {
  const session=connect(name);
  try {
    await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    check((await session.query("SELECT current_setting('transaction_read_only')")).trim()==='on','operator_inspection_not_read_only');
    return JSON.parse(await session.query(snapshotSql));
  } finally {await session.close().catch(()=>{});}
}
async function cloneProof(name) {
  const session=connect(name),metadata={fingerprints:{}},sourceFingerprints={};
  try {
    await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await assertEmptyObservations(session);
    for(const table of scopeTables('observations-v1'))metadata.fingerprints[table]=JSON.parse(await session.query(fingerprintQuery(table,'observations-v1')));
    for(const kind of ['schema','functions','rls']) {
      const rows=JSON.parse(await session.query(SCHEMA_QUERIES[kind]));
      sourceFingerprints[kind]=hash(Buffer.from(JSON.stringify(kind==='schema'?canonicalStructure(rows):rows)));
    }
    return {metadata,sourceFingerprints,evidenceOrigin:'actual-isolated-restored-clone-not-production-backup'};
  } finally {await session.close().catch(()=>{});}
}
async function terminateOwnedSession(name,pid,session) {
  check(Number.isSafeInteger(pid)&&pid>0,'operator_backend_pid_invalid');
  const result=command('docker',['exec',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-c',
    `SELECT pg_terminate_backend(pid,5000) FROM pg_stat_activity WHERE pid=${pid} AND usename='postgres' AND datname='postgres' AND pid<>pg_backend_pid()`]);
  check(result.trim()==='t','operator_owned_backend_termination_failed');
  const remaining=command('docker',['exec',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-c',
    `SELECT count(*) FROM pg_stat_activity WHERE pid=${pid}`]);
  check(remaining.trim()==='0','operator_owned_backend_still_present');
  // psql can remain blocked reading stdin after its server has exited. Close
  // only this owned transport; backend absence above is the actual loss proof.
  session.child.stdin.end('\\q\n');
  if(session.child.exitCode===null)await new Promise(resolve=>{
    const timer=setTimeout(resolve,3000);session.child.once('exit',()=>{clearTimeout(timer);resolve();});
  });
  check(session.child.exitCode!==null,'operator_owned_session_did_not_exit');
}
function diskChecks(directory,stage) {
  const key=dpapi('unprotect',fs.readFileSync(path.join(directory,'key.dpapi')));
  try {
    const bytes=fs.readFileSync(path.join(directory,stage+'.enc'));
    const plain=decryptBytes(bytes,key);
    const value=JSON.parse(plain);
    check(!bytes.includes(Buffer.from('5900340003615')),'operator_envelope_contains_plaintext_canary');
    const corrupted=Buffer.from(bytes);corrupted[25]^=1;
    let rejected=false;try {decryptBytes(corrupted,key);}catch {rejected=true;}
    check(rejected,'operator_envelope_tamper_not_rejected');
    plain.fill(0);return value;
  } finally {key.fill(0);}
}

async function lostReplyScenario(name,plan,mode) {
  const real=connect(name),store=createEnvelopeStore(plan),events=[];
  let dead=false,interruptionConfirmed=false;
  const pid=Number((await real.query('SELECT pg_backend_pid()')).trim());
  const wrapped={query:async sql=>{
    if(dead)throw new RecoveryError('controlled_closed_session');
    if(sql.includes('SELECT public.ingestion_apply_observation')) {
      diskChecks(store.directory,'before');events.push('disk-preimage-verified-before-ingestion');events.push('ingestion');
    }
    if(sql==='COMMIT') {
      diskChecks(store.directory,'after');events.push('disk-postimage-verified-before-commit');
      if(mode==='after-commit'){await real.query(sql);events.push('commit-acknowledged-in-injection');}
      await terminateOwnedSession(name,pid,real);dead=true;interruptionConfirmed=true;events.push('owned-session-terminated-and-backend-absence-verified');
      throw new RecoveryError('controlled_lost_commit_reply');
    }
    return real.query(sql);
  }};
  let classified=false;
  try {await applyInSession(wrapped,plan,store);}
  catch(error){classified=error instanceof RecoveryError&&error.code==='operator_commit_outcome_uncertain_inspect_envelope_no_retry';
    if(!classified)throw error;}
  finally {store.close();if(!dead)await real.close().catch(()=>{});}
  check(classified,'operator_lost_reply_not_classified');
  check(interruptionConfirmed,'operator_controlled_interruption_not_proven');
  const reopened=loadEnvelope(store.directory,{allowRehearsal:true});
  const current=await freshSnapshot(name);
  const outcome=inspectOutcome(reopened.envelope,current);
  check(outcome===(mode==='before-commit'?'NOT_APPLIED_MATCHING_PREIMAGE':'APPLIED_MATCHING_POSTIMAGE'),'operator_uncertain_inspection_wrong_state');
  check(events.filter(e=>e==='ingestion').length===1,'operator_blind_retry_detected');
  let prodRejected=false;try{loadEnvelope(store.directory);}catch(error){prodRejected=error.code==='operator_rehearsal_envelope_not_production';}
  check(prodRejected,'operator_clone_envelope_accepted_as_production');
  return {mode,outcome,events,encryptedEnvelopesReopened:true,authenticatedTamperRejected:true,
    productionReplayRejected:true,envelopeDirectory:path.relative(ROOT,store.directory),envelope:reopened.envelope};
}

export async function rehearseOperator({catalogDirectory,schemaDirectory,databaseAuthorityPath,execute=false}={}) {
  const pilot=pilotPlan(),sourceHead=command('git',['rev-parse','HEAD'],{cwd:ROOT}).trim();
  const operatorSourceSha256=hash(fs.readFileSync(path.join(ROOT,'scripts/recovery/cohort-pilot-operator.mjs')));
  const rehearsalSourceSha256=hash(fs.readFileSync(fileURLToPath(import.meta.url)));
  if(!execute)return {result:'PLAN',method:'isolated-operator-envelope-rehearsal',sourceHead,migrationManifestSha256:pilot.manifestSha256,remoteReads:false,remoteWrites:false};
  check(catalogDirectory&&schemaDirectory&&databaseAuthorityPath,'operator_clone_inputs_required');
  const authority=JSON.parse(fs.readFileSync(path.resolve(ROOT,databaseAuthorityPath)));
  let stages=[];
  const result=await schemaCatalogRecovery({catalogDirectory:path.resolve(ROOT,catalogDirectory),schemaDirectory:path.resolve(ROOT,schemaDirectory),
    manifestSha256:pilot.manifestSha256,scopeProfile:'consumer-v1',execute:true,writeReceipt:false,
    onVerifiedRestore:async context=>{
      check(Object.values(context.restoreDatabaseAuthority(authority)).every(v=>v===true),'operator_clone_authority_mismatch');
      for(const entry of pilot.manifest.migrations) {
        const bytes=fs.readFileSync(path.join(ROOT,entry.path));check(hash(bytes)===entry.sha256,'operator_clone_migration_changed');
        context.sqlAsPostgres(bytes.toString('utf8'),'operator_clone_migration');
      }
      const name=markedContainer(context,randomBytes(16).toString('hex'));
      const proof=await cloneProof(name);
      const plan={pilot,proof,sourceHead,executionEnvironment:'isolated-clone',
        planSha256:hash(Buffer.from(JSON.stringify({method:'clone-only',sourceHead,pilot:pilot.digest,sourceFingerprints:proof.sourceFingerprints})))};
      const before=await lostReplyScenario(name,plan,'before-commit');
      stages.push({...before,envelope:undefined});
      const after=await lostReplyScenario(name,plan,'after-commit');
      stages.push({...after,envelope:undefined});
      const session=connect(name),reversalStore=createEnvelopeStore(plan);
      let reversal;
      try {
        reversal=await rollbackInSession(session,after.envelope,value=>reversalStore.save('reversal',value));
        diskChecks(reversalStore.directory,'reversal');
      } finally {reversalStore.close();await session.close().catch(()=>{});}
      const final=await freshSnapshot(name);
      check(inspectOutcome(after.envelope,final)==='REVERSED_MATCHING_BASELINE','operator_final_read_only_inspection_failed');
      check(final.observations.length===1&&final.source.selected_observation_id===null,'operator_history_not_retained');
      return {result:'PASS',stages,reversal:{...reversal,remoteWrites:false,localCloneWrites:true,
        encryptedEnvelopeReopened:true,readOnlyInspection:'REVERSED_MATCHING_BASELINE'},
        durableWriteMethod:'exclusive create + fsyncSync + decrypt/re-read disk file before DML/COMMIT',
        production21BackupCertified:false,scopeProofOrigin:proof.evidenceOrigin};
    }});
  check(operatorSourceSha256===hash(fs.readFileSync(path.join(ROOT,'scripts/recovery/cohort-pilot-operator.mjs')))&&
    rehearsalSourceSha256===hash(fs.readFileSync(fileURLToPath(import.meta.url))),'operator_source_changed_during_rehearsal');
  const receipt={schemaVersion:1,method:'real-retained-clone-operator-and-durable-envelopes',checkedAt:new Date().toISOString(),
    sourceHead,operatorSourceSha256,rehearsalSourceSha256,
    migrationManifestSha256:pilot.manifestSha256,remoteReads:false,remoteWrites:false,production21BackupCertified:false,...result};
  const directory=path.join(ROOT,'audit-reports/recovery');fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,'operator-envelope-rehearsal-'+Date.now()+'.json');
  fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n');
  return {...receipt,receipt:path.relative(ROOT,file)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),v=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  rehearseOperator({catalogDirectory:v('--catalog-directory'),schemaDirectory:v('--schema-directory'),databaseAuthorityPath:v('--database-authority'),execute:args.includes('--execute')})
    .then(result=>console.log(JSON.stringify(result)))
    .catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'operator_clone_rehearsal_failed'}));process.exitCode=1;});
}
