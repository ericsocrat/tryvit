/** Single-product operator. Default is local planning; never auto-retry a commit. */
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {hash} from '../ci/database-release.mjs';
import {RecoveryError,command,privateDirectory,scopeTables,fingerprintQuery} from './catalog-recovery.mjs';
import {validateCatalogReceipts,SCHEMA_QUERIES,canonicalStructure} from './schema-catalog-recovery.mjs';
import {dpapi,encryptBytes,decryptBytes} from './opaque-containment.mjs';
import {pilotPlan,unaffectedSql} from './cohort-pilot.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const TARGET='uskvezwftkkudvksmken';
const q=value=>"'"+value.replaceAll("'","''")+"'";
const j=value=>q(JSON.stringify(value))+'::jsonb';
const fail=code=>{throw new RecoveryError(code);};
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export function canonicalDecimal(value) {
  const match=String(value).match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if(!match)fail('operator_invalid_decimal_projection');
  let digits=(match[2]+(match[3]??'')).replace(/^0+/,'');
  if(!digits)return '0';
  const trailing=digits.match(/0+$/)?.[0].length??0;
  const power=BigInt(match[4]??0)-BigInt((match[3]??'').length)+BigInt(trailing);
  if(trailing)digits=digits.slice(0,-trailing);
  return (match[1]==='-'?'-':'')+digits+'e'+power;
}
export function revisionNumber(value) {
  if(value===null||value===undefined)return null;
  if((typeof value!=='string'&&typeof value!=='number')||
    (typeof value==='number'&&!Number.isSafeInteger(value))||!/^\d+$/.test(String(value)))
    fail('operator_invalid_source_revision');
  const revision=BigInt(value);
  if(revision<=0n||revision>9223372036854775807n)fail('operator_invalid_source_revision');
  return revision;
}
export function timestampMicros(value,{nullable=false}={}) {
  if(nullable&&(value===null||value===undefined))return null;
  if(typeof value!=='string')fail('operator_invalid_source_timestamp');
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/);
  if(!match)fail('operator_invalid_source_timestamp');
  const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
  const zoneHour=Number(match[10]??0),zoneMinute=Number(match[11]??0);
  const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(hour,minute,second,0);
  if(year<1||month<1||month>12||day<1||hour>23||minute>59||second>59||zoneHour>23||zoneMinute>59||
    date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)
    fail('operator_invalid_source_timestamp');
  const offset=(zoneHour*60+zoneMinute)*(match[9]==='-'?-1:1);
  return BigInt(date.getTime()-offset*60000)*1000n+BigInt((match[7]??'').padEnd(6,'0'));
}

export function ingestionInputs(sql) {
  const match=sql.match(/result := public\.ingestion_apply_observation\(('(?:[^']|'')*')::jsonb,('(?:[^']|'')*')::jsonb\);/);
  if(!match)fail('pilot_ingestion_arguments_not_exact');
  return match.slice(1).map(value=>JSON.parse(value.slice(1,-1).replaceAll("''","'")));
}

function privatePath(value) {
  const resolved=path.resolve(ROOT,value||'');
  if(!resolved.startsWith(path.join(ROOT,'backups')+path.sep)||fs.realpathSync(resolved)!==resolved)
    fail('operator_artifact_not_private');
  return resolved;
}

export function validateCombinedProof(receipt,metadata,encryptedHash,manifestHash) {
  const checks=['schema','functions','grants','rls','roleAttributes','roleMemberships','extensionBootstrap',
    'rowCounts','identityReferences','representativeValues','syntheticRoles'];
  if(receipt.schemaVersion!==2||receipt.scopeProfile!=='observations-v1'||receipt.scope!=='schema-and-catalog'||
    receipt.environment!=='production'||receipt.method!=='backup-restore'||receipt.result!=='PASS'||
    receipt.observationDisposition!=='empty-in-export-snapshot'||receipt.catalogTableCount!==21||
    !same(receipt.catalogTables,scopeTables('observations-v1'))||
    receipt.migrationManifestSha256!==manifestHash||receipt.encryptedBackupSha256!==encryptedHash||
    receipt.catalogSha256!==hash(Buffer.from(JSON.stringify(metadata.fingerprints)))||receipt.restoredCatalogSha256!==receipt.catalogSha256||
    !checks.every(key=>receipt.checks?.[key]===true)||receipt.privateProductionRowsExported!==false)
    fail('operator_requires_exact_restored_empty21_proof');
}

export function operatorPlan({catalogDirectory,schemaDirectory,sourceHead,target=TARGET}={}) {
  const pilot=pilotPlan();
  const head=command('git',['rev-parse','HEAD'],{cwd:ROOT}).trim();
  if(sourceHead&&sourceHead!==head)fail('operator_source_head_changed');
  if(target!==TARGET)fail('operator_wrong_target');
  const sourceHash=hash(fs.readFileSync(fileURLToPath(import.meta.url)));
  let proof=null;
  if(catalogDirectory||schemaDirectory) {
    if(!catalogDirectory||!schemaDirectory)fail('operator_recovery_pair_required');
    const catalog=privatePath(catalogDirectory),schema=privatePath(schemaDirectory);
    const metadata=JSON.parse(fs.readFileSync(path.join(catalog,'source-metadata.json')));
    const receipts=['receipt.json','verification-v2.json'].filter(name=>fs.existsSync(path.join(catalog,name)))
      .map(name=>JSON.parse(fs.readFileSync(path.join(catalog,name))));
    const catalogHash=hash(fs.readFileSync(path.join(catalog,'catalog.dump')));
    validateCatalogReceipts(receipts,metadata,catalogHash,'observations-v1');
    const combined=JSON.parse(fs.readFileSync(path.join(schema,'receipt.json')));
    const encryptedHash=hash(fs.readFileSync(path.join(schema,'schema.dump.enc')));
    validateCombinedProof(combined,metadata,encryptedHash,pilot.manifestSha256);
    proof={catalogHash,encryptedHash,receiptSha256:hash(fs.readFileSync(path.join(schema,'receipt.json'))),
      restoredAt:combined.restoredAt,metadata,sourceFingerprints:combined.sourceFingerprints};
  }
  const binding={schemaVersion:1,target,sourceHead:head,operatorSourceSha256:sourceHash,pilotPlanSha256:pilot.digest,
    migrationManifestSha256:pilot.manifestSha256,recovery:proof?{catalogHash:proof.catalogHash,encryptedHash:proof.encryptedHash,
      receiptSha256:proof.receiptSha256,restoredAt:proof.restoredAt}:null};
  return {result:proof?'PLAN_READY_FOR_REVIEW':'PLAN_RECOVERY_REQUIRED',...binding,planSha256:hash(Buffer.from(JSON.stringify(binding))),
    remoteReads:false,remoteWrites:false,localWrites:false,proof,pilot};
}

export const lockSql=`SET LOCAL TIME ZONE 'UTC'; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('PL:5900340003615',0));
SELECT product_id FROM public.products WHERE product_id=178 FOR UPDATE;
SELECT product_id FROM public.nutrition_facts WHERE product_id=178 FOR UPDATE;
SELECT product_id FROM public.product_field_provenance WHERE product_id=178 FOR UPDATE;
SELECT id FROM public.product_source_records WHERE country='PL' AND external_id='5900340003615' FOR UPDATE;
SELECT source_record_id FROM public.product_source_assertions WHERE source_record_id IN
  (SELECT id FROM public.product_source_records WHERE country='PL' AND external_id='5900340003615') FOR UPDATE;`;

const pilotSources="SELECT id FROM public.product_source_records WHERE country='PL' AND external_id='5900340003615'";
const pilotSourceUnaffected=scopeTables('observations-v1').filter(t=>!scopeTables('consumer-v1').includes(t)).map(table=>{
  const where=table==='product_source_records'?`id NOT IN (${pilotSources})`:table==='ingestion_batches'?
    `id NOT IN (SELECT batch_id FROM public.product_source_observations WHERE source_record_id IN (${pilotSources}))`:
    `source_record_id NOT IN (${pilotSources})`;
  return `${q(table)},(SELECT encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),''),'UTF8')),'hex') FROM public.${table} t WHERE ${where})`;
}).join(',');
export const snapshotSql=`SELECT jsonb_build_object(
  'product',(SELECT to_jsonb(p)||jsonb_build_object('off_revision',off_revision::text) FROM public.products p WHERE product_id=178),
  -- Numeric text preserves PostgreSQL decimal precision AND display scale
  -- through JSON/JavaScript; never round a durable rollback preimage to Number.
  'nutrition',(SELECT to_jsonb(n)||jsonb_build_object('calories',calories::text,'total_fat_g',total_fat_g::text,
    'saturated_fat_g',saturated_fat_g::text,'trans_fat_g',trans_fat_g::text,'carbs_g',carbs_g::text,
    'sugars_g',sugars_g::text,'fibre_g',fibre_g::text,'protein_g',protein_g::text,'salt_g',salt_g::text)
    FROM public.nutrition_facts n WHERE product_id=178),
  'provenance',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY field_name),'[]'::jsonb) FROM public.product_field_provenance p WHERE product_id=178),
  'source',(SELECT to_jsonb(s) FROM public.product_source_records s WHERE country='PL' AND external_id='5900340003615'),
  'assertions',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY kind,position),'[]'::jsonb) FROM public.product_source_assertions a
    WHERE source_record_id IN (SELECT id FROM public.product_source_records WHERE country='PL' AND external_id='5900340003615')),
  'observations',(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'payload_hash',payload_hash,'source_revision',source_revision::text,
    'retrieved_at',retrieved_at,'source_updated_at',source_updated_at,'status',status,
    'row_sha256',encode(sha256(convert_to(to_jsonb(o)::text,'UTF8')),'hex')) ORDER BY id),'[]'::jsonb)
    FROM public.product_source_observations o WHERE source_record_id IN
      (SELECT id FROM public.product_source_records WHERE country='PL' AND external_id='5900340003615')),
  'sourceCounts',jsonb_build_array((SELECT count(*) FROM public.ingestion_batches),(SELECT count(*) FROM public.product_source_records),
    (SELECT count(*) FROM public.product_source_observations),(SELECT count(*) FROM public.product_source_assertions)),
  'identityIds',(SELECT jsonb_agg(product_id ORDER BY product_id) FROM public.products WHERE country='PL' AND ean='5900340003615'),
  'competingNames',(SELECT COALESCE(jsonb_agg(product_id ORDER BY product_id),'[]'::jsonb) FROM public.products
    WHERE country='PL' AND lower(btrim(brand))='oskroba' AND lower(btrim(product_name))=lower('Chleb żytni razowy') AND NOT is_deprecated AND product_id<>178),
  'unaffected',(${unaffectedSql()})||jsonb_build_object(${pilotSourceUnaffected}),
  'model',evidence_private.product_one(178,'en'))`;

export function validateBefore(before,record) {
  if(!before.product||!before.nutrition||before.product.product_id!==178||before.product.country!=='PL'||
    before.product.ean!=='5900340003615'||before.product.is_deprecated||!same(before.identityIds,[178])||
    !same(before.competingNames,[])||!same(before.sourceCounts,[0,0,0,0])||before.source!==null||
    before.provenance.length||before.assertions.length||before.observations.length)
    fail('operator_fresh_identity_or_source_conflict');
  if(before.product.brand!==record.identity.brand||before.product.product_name!==record.identity.product_name||before.product.category!==record.identity.category)
    fail('operator_unreviewed_identity_attribute_change');
  const retrieved=timestampMicros(record.retrieved_at),updated=timestampMicros(record.source_updated_at,{nullable:true});
  const fetched=timestampMicros(before.product.last_fetched_at,{nullable:true});
  if(updated!==null&&updated>retrieved)fail('operator_source_update_after_retrieval');
  if(fetched!==null&&fetched>retrieved)fail('operator_newer_projection_exists');
  const existingRevision=revisionNumber(before.product.off_revision),incomingRevision=revisionNumber(record.source_revision);
  if(existingRevision!==null&&incomingRevision!==null&&existingRevision>incomingRevision)fail('operator_newer_revision_exists');
  if(before.model?.evidence?.state!=='legacy_unverified')fail('operator_baseline_not_legacy');
}

export function validateAfter(before,after,record) {
  const o=after.observations[0];
  if(!same(before.unaffected,after.unaffected)||!same(after.identityIds,[178])||!same(after.competingNames,[])||
    after.observations.length!==1||!o||o.payload_hash!==record.payload_hash||o.status!=='accepted'||
    timestampMicros(o.retrieved_at)!==timestampMicros(record.retrieved_at)||
    timestampMicros(o.source_updated_at,{nullable:true})!==timestampMicros(record.source_updated_at,{nullable:true})||
    revisionNumber(o.source_revision)!==revisionNumber(record.source_revision)||
    after.source?.selected_observation_id!==o.id||after.source?.product_id!==178||after.source?.source_key!=='off_api'||
    !same(after.sourceCounts,[1,1,1,0])||after.assertions.length||after.nutrition.trans_fat_g!==null||after.nutrition.fibre_g!==null)
    fail('operator_post_import_mismatch');
  const fields=record.extracted_fields;
  const nutrientColumns={calories_100g:'calories',fat_100g:'total_fat_g',saturated_fat_100g:'saturated_fat_g',
    trans_fat_100g:'trans_fat_g',carbs_100g:'carbs_g',sugars_100g:'sugars_g',fiber_100g:'fibre_g',protein_100g:'protein_g',salt_100g:'salt_g'};
  for(const [field,column] of Object.entries(nutrientColumns)) {
    const value=fields[field];
    const expected=value.state==='recorded'&&value.qualifier==='eq'?value.value:null;
    if(expected===null?after.nutrition[column]!==null:after.nutrition[column]===null||canonicalDecimal(after.nutrition[column])!==canonicalDecimal(expected))
      fail('operator_nutrient_projection_mismatch');
  }
  if(Object.keys(fields).length!==after.provenance.length||Object.entries(fields).some(([key,value])=>{
    const p=after.provenance.find(item=>item.field_name===key);
    return !p||p.observation_id!==o.id||p.evidence_state!==value.state||p.basis!==(value.basis??'unknown');
  }))fail('operator_provenance_mismatch');
}

function durableFile(filename,bytes) {
  const fd=fs.openSync(filename,'wx',0o600);
  try {fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
}
export function createEnvelopeStore(plan) {
  fs.mkdirSync(path.join(ROOT,'backups'),{recursive:true,mode:0o700});
  const executionEnvironment=plan.executionEnvironment??'production';
  if(!['production','isolated-clone'].includes(executionEnvironment))fail('operator_unknown_execution_environment');
  const kind=plan.artifactKind??'pilot178';
  if(!/^(pilot178|cohort-batch-[1-9][0-9]*)$/.test(kind))fail('operator_invalid_artifact_kind');
  const directory=path.join(ROOT,'backups',kind+(executionEnvironment==='isolated-clone'?'_rehearsal_':'_')+Date.now()+'_'+randomBytes(6).toString('hex'));
  privateDirectory(directory);
  const key=randomBytes(32);
  durableFile(path.join(directory,'key.dpapi'),dpapi('protect',key));
  return {directory,save(stage,value){
    const plain=Buffer.from(JSON.stringify({planSha256:plan.planSha256,sourceHead:plan.sourceHead,target:TARGET,executionEnvironment,...value}));
    try {
      const encrypted=encryptBytes(plain,key);
      durableFile(path.join(directory,stage+'.enc'),encrypted);
      const disk=fs.readFileSync(path.join(directory,stage+'.enc'));
      if(!decryptBytes(disk,key).equals(plain))fail('operator_durable_envelope_verification_failed');
      return hash(disk);
    } finally {plain.fill(0);}
  },close(){key.fill(0);}};
}

export async function applyInSession(session,plan,store) {
  const [batch,record]=ingestionInputs(plan.pilot.sql.mutation);
  let commitAttempted=false;
  try {
    await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await session.query(lockSql);
    if(plan.verifyRecovery)await plan.verifyRecovery(session);
    else {
    for(const kind of ['schema','functions','rls']) {
      const value=JSON.parse(await session.query(SCHEMA_QUERIES[kind]));
      const actual=hash(Buffer.from(JSON.stringify(kind==='schema'?canonicalStructure(value):value)));
      if(actual!==plan.proof.sourceFingerprints?.[kind])fail('operator_schema_changed_since_backup');
    }
    // A timestamp cutoff is not recovery freshness proof: compare all scoped
    // live rows against the reviewed backup in this very transaction.
    for(const table of scopeTables('observations-v1')) {
      const actual=JSON.parse(await session.query(fingerprintQuery(table,'observations-v1')));
      if(!same(actual,plan.proof.metadata.fingerprints[table]))fail('operator_catalog_changed_since_backup');
    }
    }
    const before=JSON.parse(await session.query(snapshotSql));
    validateBefore(before,record);
    // The complete selected preimage and unaffected-row digests are durable
    // before the first DML call. Never log or write plaintext product snapshots.
    const beforeSha=store.save('before',{before});
    const accepted=JSON.parse(await session.query(`SELECT public.ingestion_apply_observation(${j(batch)},${j(record)})`));
    if(accepted.status!=='accepted'||accepted.product_id!==178)fail('operator_ingestion_not_accepted');
    const after=JSON.parse(await session.query(snapshotSql));
    validateAfter(before,after,record);
    const afterSha=store.save('after',{before,after,beforeEncryptedSha256:beforeSha});
    commitAttempted=true;
    await session.query('COMMIT');
    return {result:'APPLIED',productId:178,planSha256:plan.planSha256,beforeEncryptedSha256:beforeSha,
      afterEncryptedSha256:afterSha,observationId:accepted.observation_id,remoteWrites:true};
  } catch(error) {
    await session.query('ROLLBACK').catch(()=>{});
    if(commitAttempted)fail('operator_commit_outcome_uncertain_inspect_envelope_no_retry');
    throw error;
  }
}

export function reversalSql(before,after) {
  if(before.provenance.length||before.assertions.length||before.source!==null)fail('operator_rollback_scope_not_first_pilot');
  const p=before.product,n=before.nutrition;
  const productColumns=['brand','product_name','category','source_type','source_url','source_ean','last_fetched_at','off_revision'];
  const nutritionColumns=['calories','total_fat_g','saturated_fat_g','trans_fat_g','carbs_g','sugars_g','fibre_g','protein_g','salt_g'];
  const set=columns=>columns.map(c=>`${c}=b.${c}`).join(',');
  return `UPDATE public.products p SET ${set(productColumns)} FROM jsonb_populate_record(NULL::public.products,${j(p)}) b WHERE p.product_id=178;
UPDATE public.nutrition_facts n SET ${set(nutritionColumns)} FROM jsonb_populate_record(NULL::public.nutrition_facts,${j(n)}) b WHERE n.product_id=178;
DELETE FROM public.product_field_provenance WHERE product_id=178 AND observation_id=${q(after.observations[0].id)}::uuid;
DELETE FROM public.product_source_assertions WHERE source_record_id=${q(after.source.id)}::uuid AND observation_id=${q(after.observations[0].id)}::uuid;
UPDATE public.product_source_records SET selected_observation_id=NULL WHERE id=${q(after.source.id)}::uuid;`;
}

export function pilotTarget(snapshot) {const {unaffected,sourceCounts,...target}=snapshot;return target;}
export function validateReversal(before,after,current,unaffectedBefore=before) {
  const omitTime=object=>{const copy={...object};delete copy.updated_at;return copy;};
  const checks={product:same(omitTime(before.product),omitTime(current.product)),nutrition:same(omitTime(before.nutrition),omitTime(current.nutrition)),
    provenance:same(before.provenance,current.provenance),assertions:same(before.assertions,current.assertions),
    model:same(before.model,current.model)&&current.model?.evidence?.state==='legacy_unverified',
    source:same(current.source,{...after.source,selected_observation_id:null})&&current.source?.product_id===178,
    observations:same(after.observations,current.observations),unaffected:same(unaffectedBefore.unaffected,current.unaffected)};
  for(const [name,passed] of Object.entries(checks))if(!passed)fail('operator_reversal_'+name+'_postcondition_failed');
}

export async function rollbackInSession(session,envelope,save,{verifyRecovery}={}) {
  const {before,after}=envelope;
  let commitAttempted=false;
  try {
    await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await session.query(lockSql);
    if(verifyRecovery)await verifyRecovery(session);
    const current=JSON.parse(await session.query(snapshotSql));
    if(!same(pilotTarget(current),pilotTarget(after)))fail('operator_reversal_refuses_concurrent_change');
    await session.query(reversalSql(before,after));
    const restored=JSON.parse(await session.query(snapshotSql));
    validateReversal(before,after,restored,current);
    if(!same(current.sourceCounts,restored.sourceCounts))fail('operator_reversal_source_counts_changed');
    const proofHash=save({before,after,restored});
    commitAttempted=true;await session.query('COMMIT');
    return {result:'REVERSED',productId:178,immutableObservationRetained:true,canonicalLegacyModelRestored:true,
      reversalEncryptedSha256:proofHash,technicalTimestampsChanged:true,remoteWrites:true};
  } catch(error) {
    await session.query('ROLLBACK').catch(()=>{});
    if(commitAttempted)fail('operator_rollback_commit_outcome_uncertain_inspect_no_retry');
    throw error;
  }
}

export function loadEnvelope(envelopeDirectory,{allowRehearsal=false}={}) {
  const directory=privatePath(envelopeDirectory);
  const key=dpapi('unprotect',fs.readFileSync(path.join(directory,'key.dpapi')));
  let envelope;
  try {
    envelope=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,'after.enc')),key));
    const before=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,'before.enc')),key));
    if(envelope.target!==TARGET||envelope.planSha256!==before.planSha256||envelope.sourceHead!==before.sourceHead||
      !same(envelope.entry,before.entry)||!same(envelope.before,before.before)||
      envelope.executionEnvironment!==before.executionEnvironment||
      envelope.beforeEncryptedSha256!==hash(fs.readFileSync(path.join(directory,'before.enc'))))fail('operator_envelope_pair_mismatch');
    if(envelope.executionEnvironment!=='production'&&!(allowRehearsal&&envelope.executionEnvironment==='isolated-clone'))
      fail('operator_rehearsal_envelope_not_production');
  } finally {key.fill(0);}
  return {directory,envelope};
}

export function rollbackPlan({envelopeDirectory,sourceHead,target=TARGET}={}) {
  if(target!==TARGET)fail('operator_wrong_target');
  const head=command('git',['rev-parse','HEAD'],{cwd:ROOT}).trim();
  if(sourceHead&&sourceHead!==head)fail('operator_source_head_changed');
  const {directory,envelope}=loadEnvelope(envelopeDirectory);
  const binding={schemaVersion:1,action:'rollback',target:TARGET,sourceHead:head,
    operatorSourceSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),originalPlanSha256:envelope.planSha256,
    afterEncryptedSha256:hash(fs.readFileSync(path.join(directory,'after.enc')))};
  return {result:'ROLLBACK_PLAN_READY_FOR_REVIEW',...binding,planSha256:hash(Buffer.from(JSON.stringify(binding))),
    remoteReads:false,remoteWrites:false,localWrites:false,directory,envelope};
}

export async function reverse(options={}) {
  if(options.execute)fail('operator_use_versioned_production_wrapper');
  const plan=rollbackPlan(options);
  const {directory,envelope,...summary}=plan;return summary;
}

export function inspectOutcome(envelope,current) {
  if(same(pilotTarget(current),pilotTarget(envelope.after)))return 'APPLIED_MATCHING_POSTIMAGE';
  if(same(pilotTarget(current),pilotTarget(envelope.before)))return 'NOT_APPLIED_MATCHING_PREIMAGE';
  try {validateReversal(envelope.before,envelope.after,current,current);return 'REVERSED_MATCHING_BASELINE';}
  catch {return 'DRIFT_REQUIRES_REVIEW';}
}
export async function inspect(options={}) {
  if(options.execute)fail('operator_use_versioned_production_wrapper');
  const plan=rollbackPlan(options);
  const {directory,envelope,...summary}=plan;return {...summary,result:'INSPECT_PLAN_READ_ONLY'};
}

export async function operate(options={}) {
  if(options.execute)fail('operator_use_versioned_production_wrapper');
  const plan=operatorPlan(options);
  const {proof,pilot,...summary}=plan;return summary;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),v=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  if(args.includes('--execute')) {
    console.error(JSON.stringify({result:'HOLD',code:'operator_use_versioned_production_wrapper'}));process.exit(1);
  }
  (args.includes('--inspect')?inspect:args.includes('--rollback')?reverse:operate)({envelopeDirectory:v('--envelope-directory'),catalogDirectory:v('--catalog-directory'),schemaDirectory:v('--schema-directory'),sourceHead:v('--source-head'),target:v('--target')??undefined,
    execute:args.includes('--execute'),confirmDigest:v('--confirm-sha256'),envFile:v('--source-env-file'),sourceCa:v('--source-ca')})
    .then(value=>console.log(JSON.stringify(value)))
    .catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'pilot_operator_failed'}));process.exitCode=1;});
}
