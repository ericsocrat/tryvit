/** Retained pilot rehearsal. This entrypoint has no remote execution path. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,validateManifest} from '../ci/database-release.mjs';
import {RecoveryError,scopeTables} from './catalog-recovery.mjs';
import {schemaCatalogRecovery} from './schema-catalog-recovery.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const PILOT='audit-reports/evidence-cohort/production-import-plan-20260908/pilot-178.sql';
const PIN='7256a4bb089c699af963ff0f4a9a8a1e017b6049382a5ab17b1fb297a4b49259';
const MANIFEST='docs/releases/evidence-first-consumer.migrations.json';
const OBSERVATION='audit-reports/evidence-cohort/run-20260905T101700Z/PL-178-5900340003615.observation.json';
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const dataSql=table=>`COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text COLLATE "C") FROM public.${table} t),'[]'::jsonb)`;
// Full-row hashes for every baseline catalog table, excluding only the three
// selected product projections intentionally changed by this pilot.
export function unaffectedSql() {
  return 'SELECT jsonb_build_object('+scopeTables('consumer-v1').map(table=>{
    const where=['products','nutrition_facts','product_field_provenance'].includes(table)?' WHERE product_id<>178':'';
    return `${quote(table)},(SELECT encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),''),'UTF8')),'hex') FROM public.${table} t${where})`;
  }).join(',')+')';
}
export const prepareSql=`BEGIN;
CREATE SCHEMA recovery_pilot;
REVOKE ALL ON SCHEMA recovery_pilot FROM PUBLIC;
DO $gate$ BEGIN
  IF EXISTS(SELECT 1 FROM public.ingestion_batches) OR EXISTS(SELECT 1 FROM public.product_source_records)
    OR EXISTS(SELECT 1 FROM public.product_source_observations) OR EXISTS(SELECT 1 FROM public.product_source_assertions)
    THEN RAISE EXCEPTION 'pilot_requires_empty_observation_baseline'; END IF;
  IF (SELECT count(*) FROM public.products WHERE country='PL' AND ean='5900340003615')<>1
    OR NOT EXISTS(SELECT 1 FROM public.products WHERE product_id=178 AND country='PL' AND ean='5900340003615' AND NOT is_deprecated)
    THEN RAISE EXCEPTION 'pilot_identity_not_unique'; END IF;
END $gate$;
CREATE TABLE recovery_pilot.product_before AS SELECT * FROM public.products WHERE product_id=178;
CREATE TABLE recovery_pilot.nutrition_before AS SELECT * FROM public.nutrition_facts WHERE product_id=178;
CREATE TABLE recovery_pilot.provenance_before AS SELECT * FROM public.product_field_provenance WHERE product_id=178;
CREATE TABLE recovery_pilot.read_before AS SELECT evidence_private.product_one(178,'en') AS model;
CREATE TABLE recovery_pilot.independent_before AS SELECT ${dataSql('product_ingredient')} AS ingredients,${dataSql('product_allergen_info')} AS allergens;
CREATE TABLE recovery_pilot.unaffected_before AS ${unaffectedSql()} AS fingerprints;
COMMIT;`;

export function preparationSql() {
  return prepareSql;
}

export function acceptedSql(observation) {
  const payload=quote(observation.payload_hash),retrieved=quote(observation.retrieved_at),updated=quote(observation.source_updated_at);
  const expected=quote(JSON.stringify(observation.extracted_fields));
  return `BEGIN;
DO $verify$ BEGIN
  IF (SELECT count(*) FROM public.product_source_observations)<>1
    OR (SELECT count(*) FROM public.product_source_records)<>1 OR (SELECT count(*) FROM public.ingestion_batches)<>1
    OR NOT EXISTS(SELECT 1 FROM public.product_source_records s JOIN public.product_source_observations o ON o.id=s.selected_observation_id
      WHERE s.product_id=178 AND s.country='PL' AND s.external_id='5900340003615' AND s.source_key='off_api'
      AND o.status='accepted' AND o.payload_hash=${payload} AND o.retrieved_at=${retrieved}::timestamptz
      AND o.source_updated_at=${updated}::timestamptz AND o.extracted_fields=${expected}::jsonb)
    THEN RAISE EXCEPTION 'pilot_selected_observation_mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.nutrition_facts WHERE product_id=178 AND trans_fat_g IS NULL AND fibre_g IS NULL
    AND calories=219 AND total_fat_g=1.8 AND saturated_fat_g=0.3 AND carbs_g=44 AND sugars_g=1.6 AND protein_g=4.8 AND salt_g=1.4)
    THEN RAISE EXCEPTION 'pilot_nutrition_semantics_mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(${expected}::jsonb) f LEFT JOIN public.product_field_provenance p
    ON p.product_id=178 AND p.field_name=f.key WHERE p.field_name IS NULL OR p.evidence_state IS DISTINCT FROM f.value->>'state'
      OR p.basis IS DISTINCT FROM COALESCE(f.value->>'basis','unknown')
      OR p.observation_id IS DISTINCT FROM (SELECT id FROM public.product_source_observations))
    THEN RAISE EXCEPTION 'pilot_provenance_semantics_mismatch'; END IF;
  IF (SELECT ingredients FROM recovery_pilot.independent_before) IS DISTINCT FROM ${dataSql('product_ingredient')}
    OR (SELECT allergens FROM recovery_pilot.independent_before) IS DISTINCT FROM ${dataSql('product_allergen_info')}
    THEN RAISE EXCEPTION 'pilot_independent_assertions_changed'; END IF;
  IF (SELECT fingerprints FROM recovery_pilot.unaffected_before) IS DISTINCT FROM (${unaffectedSql()})
    THEN RAISE EXCEPTION 'pilot_unaffected_catalog_changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.product_source_assertions)
    THEN RAISE EXCEPTION 'pilot_missing_source_sets_became_assertions'; END IF;
END $verify$;
CREATE TABLE recovery_pilot.product_after AS SELECT * FROM public.products WHERE product_id=178;
CREATE TABLE recovery_pilot.nutrition_after AS SELECT * FROM public.nutrition_facts WHERE product_id=178;
CREATE TABLE recovery_pilot.provenance_after AS SELECT * FROM public.product_field_provenance WHERE product_id=178;
CREATE TABLE recovery_pilot.observation_after AS SELECT * FROM public.product_source_observations;
CREATE TABLE recovery_pilot.assertions_after AS SELECT * FROM public.product_source_assertions;
CREATE TABLE recovery_pilot.source_after AS SELECT * FROM public.product_source_records;
COMMIT;
SELECT jsonb_build_object('selectedObservation',true,'retainedAge',true,'nutrientMissingness',true,
  'provenanceBasis',true,'independentAssertions',true,'unaffectedCatalog',true);`;
}

export const rollbackSql=`-- OPERATIONAL REVERSAL REHEARSAL: retain immutable observations and batch history.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('PL:5900340003615',0));
DO $rollback$ BEGIN
  PERFORM 1 FROM public.products WHERE product_id=178 FOR UPDATE;
  PERFORM 1 FROM public.nutrition_facts WHERE product_id=178 FOR UPDATE;
  PERFORM 1 FROM public.product_field_provenance WHERE product_id=178 FOR UPDATE;
  PERFORM 1 FROM public.product_source_records WHERE id=(SELECT id FROM recovery_pilot.source_after) FOR UPDATE;
  PERFORM 1 FROM public.product_source_assertions WHERE source_record_id=(SELECT id FROM recovery_pilot.source_after) FOR UPDATE;
  IF (SELECT to_jsonb(p) FROM public.products p WHERE product_id=178) IS DISTINCT FROM (SELECT to_jsonb(p) FROM recovery_pilot.product_after p)
    OR (SELECT to_jsonb(n) FROM public.nutrition_facts n WHERE product_id=178) IS DISTINCT FROM (SELECT to_jsonb(n) FROM recovery_pilot.nutrition_after n)
    OR (SELECT jsonb_agg(to_jsonb(p) ORDER BY field_name) FROM public.product_field_provenance p WHERE product_id=178)
      IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(p) ORDER BY field_name) FROM recovery_pilot.provenance_after p)
    OR (SELECT to_jsonb(s) FROM public.product_source_records s WHERE id=(SELECT id FROM recovery_pilot.source_after))
      IS DISTINCT FROM (SELECT to_jsonb(s) FROM recovery_pilot.source_after s)
    OR (SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,position) FROM public.product_source_assertions a WHERE source_record_id=(SELECT id FROM recovery_pilot.source_after))
      IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(a) ORDER BY kind,position) FROM recovery_pilot.assertions_after a)
    THEN RAISE EXCEPTION 'pilot_reversal_refuses_concurrent_change' USING ERRCODE='P1099'; END IF;
  UPDATE public.products p SET brand=b.brand,product_name=b.product_name,category=b.category,
    source_type=b.source_type,source_url=b.source_url,source_ean=b.source_ean,last_fetched_at=b.last_fetched_at,off_revision=b.off_revision
    FROM recovery_pilot.product_before b WHERE p.product_id=b.product_id;
  UPDATE public.nutrition_facts n SET calories=b.calories,total_fat_g=b.total_fat_g,saturated_fat_g=b.saturated_fat_g,
    trans_fat_g=b.trans_fat_g,carbs_g=b.carbs_g,sugars_g=b.sugars_g,fibre_g=b.fibre_g,protein_g=b.protein_g,salt_g=b.salt_g
    FROM recovery_pilot.nutrition_before b WHERE n.product_id=b.product_id;
  DELETE FROM public.product_field_provenance WHERE product_id=178 AND observation_id=(SELECT id FROM recovery_pilot.observation_after);
  INSERT INTO public.product_field_provenance SELECT * FROM recovery_pilot.provenance_before;
  DELETE FROM public.product_source_assertions WHERE source_record_id=(SELECT id FROM recovery_pilot.source_after)
    AND observation_id=(SELECT id FROM recovery_pilot.observation_after);
  UPDATE public.product_source_records SET selected_observation_id=NULL WHERE id=(SELECT id FROM recovery_pilot.source_after);
  IF (SELECT to_jsonb(p)-'updated_at' FROM public.products p WHERE product_id=178)
      IS DISTINCT FROM (SELECT to_jsonb(p)-'updated_at' FROM recovery_pilot.product_before p)
    THEN RAISE EXCEPTION 'pilot_reversal_product_failed' USING ERRCODE='P1101'; END IF;
  IF (SELECT to_jsonb(n)-'updated_at' FROM public.nutrition_facts n WHERE product_id=178) IS DISTINCT FROM (SELECT to_jsonb(n)-'updated_at' FROM recovery_pilot.nutrition_before n)
    THEN RAISE EXCEPTION 'pilot_reversal_nutrition_failed' USING ERRCODE='P1102'; END IF;
  IF EXISTS(SELECT 1 FROM public.product_field_provenance WHERE product_id=178) OR EXISTS(SELECT 1 FROM public.product_source_assertions)
    THEN RAISE EXCEPTION 'pilot_reversal_assertions_failed' USING ERRCODE='P1103'; END IF;
  IF (SELECT count(*) FROM public.product_source_observations)<>1
    OR (SELECT to_jsonb(o) FROM public.product_source_observations o) IS DISTINCT FROM (SELECT to_jsonb(o) FROM recovery_pilot.observation_after o)
    OR EXISTS(SELECT 1 FROM public.product_source_records WHERE selected_observation_id IS NOT NULL)
    THEN RAISE EXCEPTION 'pilot_reversal_history_failed' USING ERRCODE='P1104'; END IF;
  IF (SELECT fingerprints FROM recovery_pilot.unaffected_before) IS DISTINCT FROM (${unaffectedSql()})
    THEN RAISE EXCEPTION 'pilot_reversal_unaffected_failed' USING ERRCODE='P1105'; END IF;
  IF evidence_private.product_one(178,'en') IS DISTINCT FROM (SELECT model FROM recovery_pilot.read_before)
    OR evidence_private.product_one(178,'en')->'evidence'->>'state' IS DISTINCT FROM 'legacy_unverified'
    OR jsonb_array_length(evidence_private.product_one(178,'en')->'sources')<>0
    THEN RAISE EXCEPTION 'pilot_reversal_read_model_failed' USING ERRCODE='P1106'; END IF;
END $rollback$;
COMMIT;
SELECT jsonb_build_object('priorProductProjection',true,'priorNutritionProjection',true,'priorProvenance',true,
  'priorSourceSelection',true,'priorSourceAssertions',true,'immutableObservationRetained',true,'unaffectedCatalog',true,
  'canonicalReadModelRestored',true,'legacyUnverifiedAgain',true,'selectedSourceFactsAbsent',true,
  'updatedAtDisposition','Operational reversal updates product and nutrition modification times',
  'retainedMappingDisposition','New source mapping remains with original product ID and no selected observation');`;

export function pilotPlan() {
  const original=fs.readFileSync(path.join(ROOT,PILOT));
  if(hash(original)!==PIN)throw new RecoveryError('retained_pilot_sql_changed');
  const recordBytes=fs.readFileSync(path.join(ROOT,OBSERVATION));
  const observation=JSON.parse(recordBytes);
  if(hash(recordBytes)!=='76d3b5ffb8e99db631a88b323869a976d56006a6fdb784f4cce246796bcec7b2')
    throw new RecoveryError('retained_observation_changed');
  const manifestBytes=fs.readFileSync(path.join(ROOT,MANIFEST)),manifest=JSON.parse(manifestBytes);
  validateManifest(ROOT,manifest);
  if(manifest.recoveryProfile!=='consumer-v1'||manifest.migrations.length!==7)throw new RecoveryError('pilot_manifest_scope_changed');
  const mutation=original.toString('utf8').replace('-- DRY PLAN ONLY: requires a fresh 19-table recovery proof and isolated import/reversal rehearsal.',
    '-- MUTATION ARTIFACT: imports retained product 178 and COMMITS. Only execute through reviewed clone rehearsal or a separately approved production workflow.');
  const sql={prepare:preparationSql(),mutation,verify:acceptedSql(observation),rollback:rollbackSql};
  const digests=Object.fromEntries(Object.entries(sql).map(([name,value])=>[name,hash(Buffer.from(value))]));
  const digest=hash(Buffer.from(JSON.stringify({manifest:hash(manifestBytes),digests})));
  return {digest,sql,digests,manifest,manifestSha256:hash(manifestBytes)};
}

export async function rehearsePilot({catalogDirectory,schemaDirectory,databaseAuthorityPath,execute=false,confirmDigest=null}={}) {
  const plan=pilotPlan();
  if(!execute)return {result:'PLAN',planSha256:plan.digest,sqlSha256:plan.digests,migrationManifestSha256:plan.manifestSha256,
    productId:178,remoteReads:false,remoteWrites:false,localWrites:false};
  if(confirmDigest!==plan.digest)throw new RecoveryError('pilot_exact_digest_confirmation_required');
  if(!catalogDirectory||!schemaDirectory||!databaseAuthorityPath)throw new RecoveryError('pilot_retained_recovery_inputs_required');
  const authority=JSON.parse(fs.readFileSync(path.resolve(ROOT,databaseAuthorityPath),'utf8'));
  const result=await schemaCatalogRecovery({catalogDirectory:path.resolve(ROOT,catalogDirectory),schemaDirectory:path.resolve(ROOT,schemaDirectory),
    manifestSha256:plan.manifestSha256,scopeProfile:'consumer-v1',execute:true,writeReceipt:false,
    onVerifiedRestore:async context=>{
      const privileges=context.restoreDatabaseAuthority(authority);
      if(!Object.values(privileges).every(v=>v===true))throw new RecoveryError('pilot_database_authority_mismatch');
      for(const entry of plan.manifest.migrations) {
        const bytes=fs.readFileSync(path.join(ROOT,entry.path));
        if(hash(bytes)!==entry.sha256)throw new RecoveryError('pilot_migration_changed');
        context.sqlAsPostgres(bytes.toString('utf8'),'pilot_migration');
      }
      context.sqlAsPostgres(plan.sql.prepare,'pilot_prepare');
      context.sqlAsPostgres(plan.sql.mutation,'pilot_apply');
      const accepted=JSON.parse(context.sqlAsPostgres(plan.sql.verify,'pilot_verify'));
      const reversal=JSON.parse(context.sqlAsPostgres(plan.sql.rollback,'pilot_rollback').trim().split(/\r?\n/).filter(Boolean).at(-1));
      return {result:'PASS',accepted,reversal};
    }});
  const directory=path.join(ROOT,'audit-reports/recovery','cohort-pilot-'+Date.now());
  fs.mkdirSync(directory,{recursive:true});
  for(const [name,sql] of Object.entries(plan.sql))fs.writeFileSync(path.join(directory,name+'.sql'),sql);
  const receipt={schemaVersion:1,method:'isolated-retained-catalog-pilot-and-operational-reversal',checkedAt:new Date().toISOString(),
    planSha256:plan.digest,sqlSha256:plan.digests,migrationManifestSha256:plan.manifestSha256,
    remoteReads:false,remoteWrites:false,originalRecoveryReceiptModified:false,...result};
  fs.writeFileSync(path.join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  return {...receipt,receipt:path.relative(ROOT,path.join(directory,'receipt.json'))};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  rehearsePilot({catalogDirectory:value('--catalog-directory'),schemaDirectory:value('--schema-directory'),databaseAuthorityPath:value('--database-authority'),
    execute:args.includes('--execute'),confirmDigest:value('--confirm-sha256')})
    .then(result=>console.log(JSON.stringify(result)))
    .catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'pilot_rehearsal_failed'}));process.exitCode=1;});
}
