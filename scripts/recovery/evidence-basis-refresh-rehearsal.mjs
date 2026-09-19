/** Exact 55-row restored-production rehearsal. No remote reads or writes. */
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {schemaCatalogRecovery} from './schema-catalog-recovery.mjs';
import {assertContained} from './opaque-containment.mjs';
import {SqlSession,command,RecoveryError} from './catalog-recovery.mjs';
import {createEnvelopeStore,loadEnvelope} from './cohort-pilot-operator.mjs';
import {refreshManifest,refreshSelection,applyRefreshOne,rollbackRefreshOne,snapshotSql,verifyRefreshPostimages,MATRIX_SHA256} from './evidence-basis-refresh.mjs';
import {hash} from '../ci/database-release.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SOURCE_RECOVERY='backups/schema_catalog_1789266649405_54c006';
const MIGRATION='supabase/migrations/20260919120048_admit_off_observations_v2.sql';
const SOURCE_BINDING={environment:'production',project:'uskvezwftkkudvksmken',sourceHead:'82ff6ab47f60c310d7a7684e548599958d7be836',
  migrationManifestSha256:'f2f164f0e669f310fcf480eae89b4f6d09ead69fa8d0ee2e3acfe27b2bdcf048',
  codeSha256:'b287e068723c608425b334e0b2ebe6f11bf2f0e5eb8e3842d82534fa2aeab30c',
  publicAllowlistSha256:'93d0d8c40517e719a56d9640c498cc246805f622df9f1b2215b77aacdf937bd1'};
const fail=code=>{throw new RecoveryError(code);};

function locate(context) {
  const marker=randomBytes(16).toString('hex');
  context.sqlAsPostgres(`CREATE SCHEMA recovery_basis_v2; COMMENT ON SCHEMA recovery_basis_v2 IS '${marker}';`,'basis_marker');
  const names=command('docker',['ps','--filter','label=tryvit.recovery.scope=containment-probe','--format','{{.Names}}']).trim().split(/\r?\n/).filter(Boolean);
  const matches=names.filter(name=>{assertContained(JSON.parse(command('docker',['inspect',name]))[0]);
    return command('docker',['exec',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-c',
      "SELECT COALESCE(obj_description(oid,'pg_namespace'),'') FROM pg_namespace WHERE nspname='recovery_basis_v2'"]).trim()===marker;});
  if(matches.length!==1)fail('basis_clone_marker_not_unique');return matches[0];
}
function connect(name) {assertContained(JSON.parse(command('docker',['inspect',name]))[0]);
  return new SqlSession('docker',['exec','-i',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],
    {PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR});}

const cohortSummary=`SELECT jsonb_build_object(
  'selected',count(*),'known',count(*) FILTER(WHERE EXISTS(SELECT 1 FROM jsonb_each(o.extracted_fields) f WHERE f.value->>'basis' IN ('per_100g','per_100ml'))),
  'per100g',count(*) FILTER(WHERE o.extracted_fields->'calories_100g'->>'basis'='per_100g'),
  'per100ml',count(*) FILTER(WHERE o.extracted_fields->'calories_100g'->>'basis'='per_100ml'),
  'unknown',count(*) FILTER(WHERE o.extracted_fields->'calories_100g'->>'basis'='unknown'),
  'sourceRecords',(SELECT count(*) FROM public.product_source_records),'observations',(SELECT count(*) FROM public.product_source_observations),
  'v1',(SELECT count(*) FROM public.product_source_observations WHERE extractor_version='off-observations-v1'),
  'v2',(SELECT count(*) FROM public.product_source_observations WHERE extractor_version='off-observations-v2'),
  'assertions',(SELECT count(*) FROM public.product_source_assertions))
 FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id`;

export async function runBasisRefreshRehearsal({execute=false}={}) {
  const manifest=refreshManifest(),sourceHead=command('git',['rev-parse','HEAD'],{cwd:ROOT}).trim();
  const plan={result:'PLAN',sourceHead,matrixSha256:MATRIX_SHA256,manifestSha256:manifest.sha256,products:manifest.entries.length,
    recoveryDirectory:SOURCE_RECOVERY,remoteReads:false,remoteWrites:false};
  if(!execute)return plan;
  const recovery=path.join(ROOT,SOURCE_RECOVERY),migration=fs.readFileSync(path.join(ROOT,MIGRATION),'utf8'),migrationSha256=hash(Buffer.from(migration));
  const result=await schemaCatalogRecovery({catalogDirectory:recovery,schemaDirectory:recovery,combinedCapture:{binding:SOURCE_BINDING},
    scopeProfile:'observations-public-cohort-v1',manifestSha256:SOURCE_BINDING.migrationManifestSha256,execute:true,writeReceipt:false,cloneLifetimeSeconds:1200,
    onVerifiedRestore:async context=>{
      context.sqlAsPostgres(migration,'basis_v2_migration');const name=locate(context),envelopes=[],applied=[],idempotent=[];
      const beforeSession=connect(name);let before;
      try{before=JSON.parse(await beforeSession.query(cohortSummary));}finally{await beforeSession.close();}
      if(before.selected!==55||before.known!==7||before.unknown!==48||before.observations!==55)fail('basis_clone_preimage_mismatch');
      for(let offset=0;offset<manifest.entries.length;offset+=5) {
        const entries=refreshSelection(manifest,manifest.entries.slice(offset,offset+5).map(e=>e.productId),manifest.sha256),batch=[];
        for(const entry of entries) {const session=connect(name),store=createEnvelopeStore({executionEnvironment:'isolated-clone',artifactKind:'basis-refresh-'+entry.productId,
          planSha256:manifest.sha256,sourceHead});
          try {const outcome=await applyRefreshOne(session,entry,store);if(outcome.result!=='APPLIED')fail('basis_clone_apply_not_fresh');applied.push(outcome);
            const envelope=loadEnvelope(store.directory,{allowRehearsal:true}).envelope;envelopes.push(envelope);batch.push({entry,after:envelope.after});
            const duplicate=await applyRefreshOne(session,entry,{save:()=>fail('basis_clone_duplicate_wrote_envelope')});
            if(duplicate.result!=='ALREADY_APPLIED_NO_WRITE')fail('basis_clone_idempotency_failed');idempotent.push(entry.productId);
          } finally {store.close();await session.close().catch(()=>{});}}
        await verifyRefreshPostimages(()=>connect(name),batch);
      }
      const afterSession=connect(name);let after,models,pairs;
      try {after=JSON.parse(await afterSession.query(cohortSummary));
        models=JSON.parse(await afterSession.query(`SELECT jsonb_agg(evidence_private.product_one(id,'pl') ORDER BY id) FROM unnest(ARRAY[2995,3065,398,148,1031]::bigint[]) id`));
        pairs=JSON.parse(await afterSession.query(`WITH p AS (SELECT p.product_id,p.country,p.category,o.extracted_fields,
          o.extracted_fields->'calories_100g'->>'basis' basis FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id JOIN public.products p ON p.product_id=r.product_id),
          pairs AS (SELECT a.country,a.category,a.basis FROM p a JOIN p b ON b.product_id>a.product_id AND b.country=a.country AND b.category=a.category AND b.basis=a.basis
            WHERE a.basis<>'unknown' AND EXISTS(SELECT 1 FROM jsonb_each(a.extracted_fields) af(k,v) JOIN jsonb_each(b.extracted_fields) bf(k,v) USING(k)
              WHERE af.k LIKE '%_100g' AND af.v->>'state'='recorded' AND bf.v->>'state'='recorded' AND af.v->>'qualifier'='eq' AND bf.v->>'qualifier'='eq'))
          SELECT jsonb_build_object('pairs',count(*),'groups',count(DISTINCT (country,category,basis))) FROM pairs`));
      } finally {await afterSession.close();}
      if(after.selected!==55||after.known!==55||after.per100g!==48||after.per100ml!==7||after.unknown!==0||after.observations!==110||after.v1!==55||after.v2!==55||after.assertions!==502)
        fail('basis_clone_postimage_counts_mismatch');
      for(const model of models)if(model.score.status!=='retired'||model.score.value!==null)fail('basis_clone_score_restored');
      const go2995=models.find(m=>m.product_id===2995),go3065=models.find(m=>m.product_id===3065),oats=models.find(m=>m.product_id===398);
      if(go2995.nutrition.calories.value!=='42'||go2995.nutrition.sugars_g.value!=='4.5'||go2995.nutrition.calories.basis!=='per_100ml'||
        go3065.nutrition.calories.value!=='64'||go3065.nutrition.sugars_g.value!=='5'||go3065.nutrition.calories.basis!=='per_100ml'||
        oats.nutrition.calories.basis!=='per_100g')fail('basis_clone_consumer_values_mismatch');
      const reversed=[];for(const envelope of envelopes.toReversed()){const session=connect(name),store=createEnvelopeStore({executionEnvironment:'isolated-clone',artifactKind:'basis-refresh-'+envelope.entry.productId,
        planSha256:manifest.sha256,sourceHead});try{reversed.push(await rollbackRefreshOne(session,envelope,store));}finally{store.close();await session.close();}}
      const restoredSession=connect(name);let restored;try{restored=JSON.parse(await restoredSession.query(cohortSummary));}finally{await restoredSession.close();}
      if(JSON.stringify(restored)!==JSON.stringify(before))fail('basis_clone_rollback_counts_mismatch');
      return {result:'PASS',before,after,restored,applied:applied.length,idempotentNoWrite:idempotent.length,reversed:reversed.length,pairs,consumerProductIds:[2995,3065,398,148,1031],
        immutableV1Retained:after.v1===55,sourceRecordsUnchanged:before.sourceRecords===after.sourceRecords,nutritionValuesProtectedByPerMemberPostconditions:true};
    }});
  const receipt={schemaVersion:1,method:'exact-production-restored-v2-basis-refresh-and-reversal',checkedAt:new Date().toISOString(),sourceHead,
    matrixSha256:MATRIX_SHA256,refreshManifestSha256:manifest.sha256,migrationSha256,sourceRecoveryReceipt:path.join(SOURCE_RECOVERY,'receipt.json'),remoteReads:false,remoteWrites:false,...result};
  const output=path.join(ROOT,'audit-reports/evidence-basis-recovery','v2-refresh-rehearsal-'+Date.now()+'.json');fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');
  return {...receipt,receipt:path.relative(ROOT,output)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runBasisRefreshRehearsal({execute:process.argv.includes('--execute')})
  .then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'basis_rehearsal_failed'}));process.exitCode=1;});
