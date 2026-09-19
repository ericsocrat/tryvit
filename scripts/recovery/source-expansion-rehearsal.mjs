/** Exact restored-production rehearsal for one reviewed source-expansion manifest. */
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {schemaCatalogRecovery} from './schema-catalog-recovery.mjs';
import {assertContained} from './opaque-containment.mjs';
import {SqlSession,command,RecoveryError} from './catalog-recovery.mjs';
import {createEnvelopeStore,loadEnvelope} from './cohort-pilot-operator.mjs';
import {applyOne,rollbackOne,verifyBatchPostimages} from './cohort-batch.mjs';
import {loadExpansionManifest,reviewExpansionSelection} from './source-expansion-batch.mjs';
import {loadCombinedPublicRecovery,assertCombinedFreshness} from './combined-public-recovery.mjs';
import {hash} from '../ci/database-release.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const fail=code=>{throw new RecoveryError(code);};

function locate(context) {
  const marker=randomBytes(16).toString('hex');
  context.sqlAsPostgres(`CREATE SCHEMA recovery_source_expansion; COMMENT ON SCHEMA recovery_source_expansion IS '${marker}';`,'expansion_marker');
  const names=command('docker',['ps','--filter','label=tryvit.recovery.scope=containment-probe','--format','{{.Names}}']).trim().split(/\r?\n/u).filter(Boolean);
  const matches=names.filter(name=>{assertContained(JSON.parse(command('docker',['inspect',name]))[0]);
    return command('docker',['exec',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-c',
      "SELECT COALESCE(obj_description(oid,'pg_namespace'),'') FROM pg_namespace WHERE nspname='recovery_source_expansion'"]).trim()===marker;});
  if(matches.length!==1)fail('expansion_clone_marker_not_unique');return matches[0];
}
function connect(name) {assertContained(JSON.parse(command('docker',['inspect',name]))[0]);
  return new SqlSession('docker',['exec','-i',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],
    {PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR});}

const cohortSummary=`WITH selected AS (
 SELECT r.product_id,r.selected_observation_id,p.country,p.category,o.extracted_fields,o.sanitized_payload
 FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id
 JOIN public.products p ON p.product_id=r.product_id
), bases AS (
 SELECT *,COALESCE((SELECT min(v->>'basis') FROM jsonb_each(extracted_fields) f(k,v)
   WHERE k LIKE '%_100g' AND v->>'state'='recorded'),'unknown') basis FROM selected
)
SELECT jsonb_build_object('selected',count(*),'per100g',count(*) FILTER(WHERE basis='per_100g'),
 'per100ml',count(*) FILTER(WHERE basis='per_100ml'),'unknown',count(*) FILTER(WHERE basis='unknown'),
 'sourceRecords',(SELECT count(*) FROM public.product_source_records),
 'observations',(SELECT count(*) FROM public.product_source_observations),
 'assertions',(SELECT count(*) FROM public.product_source_assertions),
 'ingredientProducts',(SELECT count(DISTINCT source_record_id) FROM public.product_source_assertions WHERE kind='ingredient'),
 'explicitAllergenProducts',count(*) FILTER(WHERE sanitized_payload->'set_states'->>'allergens'='reported'),
 'oldSelectionSha256',encode(sha256(convert_to(COALESCE(string_agg(jsonb_build_object('productId',product_id,
   'observationId',selected_observation_id)::text,E'\\n' ORDER BY product_id) FILTER(WHERE product_id NOT IN (__EXPANSION_IDS__)),''),'UTF8')),'hex'))
 FROM bases`;

const comparisonSummary=`WITH p AS (SELECT p.product_id,p.country,p.category,o.extracted_fields,
 COALESCE((SELECT min(v->>'basis') FROM jsonb_each(o.extracted_fields) f(k,v)
   WHERE k LIKE '%_100g' AND v->>'state'='recorded'),'unknown') basis
 FROM public.product_source_records r JOIN public.product_source_observations o ON o.id=r.selected_observation_id
 JOIN public.products p ON p.product_id=r.product_id), pairs AS (
 SELECT a.country,a.category,a.basis FROM p a JOIN p b ON b.product_id>a.product_id AND b.country=a.country
  AND b.category=a.category AND b.basis=a.basis WHERE a.basis<>'unknown' AND EXISTS(
   SELECT 1 FROM jsonb_each(a.extracted_fields) af(k,v) JOIN jsonb_each(b.extracted_fields) bf(k,v) USING(k)
   WHERE af.k LIKE '%_100g' AND af.v->>'state'='recorded' AND bf.v->>'state'='recorded'
    AND af.v->>'qualifier'='eq' AND bf.v->>'qualifier'='eq'))
SELECT jsonb_build_object('pairs',count(*),'groups',count(DISTINCT (country,category,basis))) FROM pairs`;

export async function runExpansionRehearsal({recoveryDirectory,bindingFile,manifestFile,reviewedManifestSha256,execute=false}={}) {
  const manifest=loadExpansionManifest(manifestFile,reviewedManifestSha256),sourceHead=command('git',['rev-parse','HEAD'],{cwd:ROOT}).trim();
  const plan={result:'PLAN',sourceHead,products:manifest.entries.length,held:manifest.held.length,
    expansionManifestSha256:manifest.fileSha256,recoveryDirectory,remoteReads:false,remoteWrites:false};
  if(!execute)return plan;
  if(command('git',['status','--porcelain','--untracked-files=normal'],{cwd:ROOT}).trim())fail('expansion_rehearsal_requires_clean_source');
  const binding=JSON.parse(fs.readFileSync(path.resolve(bindingFile),'utf8'));
  const recovery=path.resolve(recoveryDirectory),proof=loadCombinedPublicRecovery(recovery,{expectedBinding:binding});
  proof.catalogArchive.fill(0);delete proof.catalogArchive;
  const expansionIds=manifest.entries.map(entry=>entry.productId),summarySql=cohortSummary.replace('__EXPANSION_IDS__',expansionIds.join(','));
  const sourceFiles=['source-expansion-batch.mjs','source-expansion-rehearsal.mjs','cohort-batch.mjs','cohort-public-recovery.mjs',
    'cohort-production-operator.mjs','combined-public-recovery.mjs'];
  const sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,hash(fs.readFileSync(path.join(ROOT,'scripts/recovery',file)))]));
  const result=await schemaCatalogRecovery({catalogDirectory:recovery,schemaDirectory:recovery,combinedCapture:{binding},
    scopeProfile:'observations-public-cohort-v1',manifestSha256:binding.migrationManifestSha256,execute:true,writeReceipt:false,
    cloneLifetimeSeconds:1800,onVerifiedRestore:async context=>{
      const name=locate(context),beforeSession=connect(name);let before,beforePairs;
      try{before=JSON.parse(await beforeSession.query(summarySql));beforePairs=JSON.parse(await beforeSession.query(comparisonSummary));
        await assertCombinedFreshness(beforeSession,proof);}finally{await beforeSession.close();}
      if(before.selected!==55||before.per100g!==48||before.per100ml!==7||before.unknown!==0||beforePairs.pairs!==96||beforePairs.groups!==12)
        fail('expansion_clone_preimage_mismatch');
      const envelopes=[],applied=[],idempotent=[],peerChecks=[];
      for(let offset=0;offset<expansionIds.length;offset+=5) {
        const entries=reviewExpansionSelection(manifest,expansionIds.slice(offset,offset+5),manifest.fileSha256),batch=[];
        for(const entry of entries) {
          const session=connect(name),store=createEnvelopeStore({executionEnvironment:'isolated-clone',artifactKind:'source-expansion-'+entry.productId,
            planSha256:manifest.fileSha256,sourceHead});
          try {
            const outcome=await applyOne(session,entry,store);if(outcome.result!=='APPLIED')fail('expansion_clone_apply_not_fresh');applied.push(outcome);
            const envelope=loadEnvelope(store.directory,{allowRehearsal:true}).envelope;envelopes.push(envelope);batch.push({entry,after:envelope.after});
            const duplicate=await applyOne(session,entry,{save:()=>fail('expansion_clone_duplicate_wrote_envelope')});
            if(duplicate.result!=='ALREADY_SELECTED_NO_WRITE')fail('expansion_clone_idempotency_failed');idempotent.push(entry.productId);
          } finally {store.close();await session.close().catch(()=>{});}
        }
        peerChecks.push(await verifyBatchPostimages(()=>connect(name),batch));
      }
      const afterSession=connect(name);let after,afterPairs,categories,models;
      const shopperIds=[2995,3065,...manifest.entries.filter(entry=>entry.nutritionBasis.length&&
        !manifest.entries.some(previous=>previous.productId<entry.productId&&previous.category===entry.category)).slice(0,5).map(entry=>entry.productId)];
      try{after=JSON.parse(await afterSession.query(summarySql));afterPairs=JSON.parse(await afterSession.query(comparisonSummary));
        categories=JSON.parse(await afterSession.query(`SELECT jsonb_object_agg(category,n) FROM (SELECT p.category,count(*) n
          FROM public.product_source_records r JOIN public.products p ON p.product_id=r.product_id WHERE r.selected_observation_id IS NOT NULL
          GROUP BY p.category ORDER BY p.category)x`));
        models=JSON.parse(await afterSession.query(`SELECT jsonb_agg(evidence_private.product_one(id,'pl') ORDER BY id)
          FROM unnest(ARRAY[${shopperIds.join(',')}]::bigint[]) id`));}finally{await afterSession.close();}
      if(after.selected!==157||after.sourceRecords!==157||after.observations!==212||after.per100g!==130||after.per100ml!==24||after.unknown!==3||
        after.oldSelectionSha256!==before.oldSelectionSha256||afterPairs.pairs<=beforePairs.pairs||afterPairs.groups<=beforePairs.groups)
        fail('expansion_clone_postimage_mismatch');
      if(models.length!==shopperIds.length||models.some(model=>model.score.status!=='retired'||model.score.value!==null))
        fail('expansion_clone_consumer_model_mismatch');
      const reversed=[];for(const envelope of envelopes.toReversed()) {
        const session=connect(name),store=createEnvelopeStore({executionEnvironment:'isolated-clone',artifactKind:'source-expansion-'+envelope.entry.productId,
          planSha256:manifest.fileSha256,sourceHead});
        try{reversed.push(await rollbackOne(session,envelope,store));}finally{store.close();await session.close();}
      }
      const restoredSession=connect(name);let restored;try{restored=JSON.parse(await restoredSession.query(summarySql));}finally{await restoredSession.close();}
      if(restored.selected!==55||restored.oldSelectionSha256!==before.oldSelectionSha256||restored.observations!==212||restored.sourceRecords!==157)
        fail('expansion_clone_reversal_mismatch');
      return {result:'PASS',before,after,restored,beforePairs,afterPairs,categories,shopperIds,applied:applied.length,
        idempotentNoWrite:idempotent.length,reversed:reversed.length,peerChecks:peerChecks.length,
        original55SelectionUnchanged:true,immutableExpansionHistoryRetained:true};
    }});
  for(const [file,digest] of Object.entries(sourceHashes))if(hash(fs.readFileSync(path.join(ROOT,'scripts/recovery',file)))!==digest)
    fail('expansion_rehearsal_source_changed');
  const receipt={schemaVersion:1,method:'exact-production-restored-source-expansion-and-reversal',checkedAt:new Date().toISOString(),
    sourceHead,sourceHashes,expansionManifestSha256:manifest.fileSha256,recoveryReceipt:path.join(recoveryDirectory,'receipt.json'),
    remoteReads:false,remoteWrites:false,...result};
  const output=path.join(ROOT,'audit-reports','source-expansion','rehearsal-'+Date.now()+'.json');
  fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');return {...receipt,receipt:path.relative(ROOT,output)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),value=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1];};
  runExpansionRehearsal({recoveryDirectory:value('--recovery-directory'),bindingFile:value('--binding-file'),
    manifestFile:value('--expansion-manifest'),reviewedManifestSha256:value('--reviewed-expansion-sha256'),execute:args.includes('--execute')})
    .then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(JSON.stringify({result:'HOLD',
      code:error instanceof RecoveryError?error.code:'expansion_rehearsal_failed'}));process.exitCode=1;});
}
