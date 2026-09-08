/** Local callbacks only. Never receives a remote connection or credential. */
import {TABLES,fingerprintQuery} from './catalog-recovery.mjs';
import {SCHEMA_QUERIES,canonicalStructure} from './schema-catalog-recovery.mjs';
import {NORMALIZED_GRANTS_SQL} from './staging-read-capture.mjs';
import {canonicalGrantRows,restoreCapturedGrants} from './staging-managed-bootstrap.mjs';
const q=x=>'"'+String(x).replaceAll('"','""')+'"';
const lit=x=>"'"+String(x).replaceAll("'","''")+"'";
const seqs=['ingredient_ref_ingredient_id_seq','products_product_id_seq','product_images_image_id_seq','freshness_policies_id_seq','product_change_log_id_seq','mv_refresh_log_refresh_id_seq'];
const views=['mv_ingredient_frequency','v_product_confidence','mv_product_similarity','v_data_coverage_summary','mv_scoring_distribution'];
const sequencesSql=()=>`SELECT jsonb_build_object(${seqs.map(s=>lit(s)+`,(SELECT jsonb_build_object('lastValue',last_value::text,'isCalled',is_called) FROM public.${q(s)})`).join(',')});`;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const check=(ok,code)=>{if(!ok)throw Error(code);};

export function initializeCapturedCatalog({sql,restoreArchive,sourceSchema,metadata,state}){
 const modes=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'mode',t.tgenabled) ORDER BY c.relname,t.tgname)
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
  AND c.relname IN ('products','ingredient_ref','product_ingredient','product_allergen_info','product_change_log','mv_refresh_log') AND NOT t.tgisinternal;`,
  'tryvit_recovery_operator','trigger_mode_check'));
 check(equal(modes,state.triggerModes)&&modes.every(m=>m.mode==='O'),'source_trigger_modes_not_represented');
 // These are solely freshly reconstructed synthetic rows inside the caller's
 // validated private container. Source/private rows have never entered it.
 sql(`TRUNCATE ${TABLES.map(t=>'public.'+q(t)).join(',')} RESTART IDENTITY CASCADE;`,'tryvit_recovery_operator','discard_local_synthetic_catalog');
 restoreArchive();
 const hashes={};for(const table of TABLES){hashes[table]=JSON.parse(sql(fingerprintQuery(table),'tryvit_recovery_operator','catalog_hash'));
   check(equal(hashes[table],state.catalog[table]),'restored_catalog_value_mismatch_'+table);}
 check(state.productChangeCount===0,'nonempty_source_audit_outside_scope');
 check(state.mvRefreshRows.every(r=>['manual','post_pipeline','scheduled','api','migration'].includes(r.triggered_by)&&views.includes(r.mv_name)),
   'operational_log_identity_guard');
 sql(`TRUNCATE public.product_change_log,public.mv_refresh_log RESTART IDENTITY;
  INSERT INTO public.mv_refresh_log(refresh_id,mv_name,refreshed_at,duration_ms,row_count,triggered_by) OVERRIDING SYSTEM VALUE
  SELECT refresh_id,mv_name,refreshed_at,duration_ms,row_count,triggered_by FROM jsonb_to_recordset(${lit(JSON.stringify(state.mvRefreshRows))}::jsonb)
  AS x(refresh_id bigint,mv_name text,refreshed_at timestamptz,duration_ms integer,row_count bigint,triggered_by text);`,'tryvit_recovery_operator','restore_operational_log');
 for(const s of ['product_change_log_id_seq','mv_refresh_log_refresh_id_seq']){
  const value=metadata.metadata.sequenceState[s];
  sql(`SELECT setval('public.${s}',${value.lastValue}::bigint,${value.isCalled});`,'tryvit_recovery_operator','restore_audit_sequence');
 }
 // Caches are explicitly recomputed, not presented as captured historical bytes.
 for(const v of views)sql(`REFRESH MATERIALIZED VIEW public.${v};`,'postgres','rebuild_catalog_cache');
 return {catalogTables:TABLES.length,catalogRows:Object.values(hashes).reduce((n,r)=>n+r.count,0),
   sourceTableHashesMatch:true,operationalLogRows:state.mvRefreshRows.length,privateRowsRestored:false,
   localSyntheticSeedRowsDiscarded:true,cacheDisposition:'recomputed-from-restored-catalog-not-original-cache-bytes'};
}

export function prepareCatchupJournal(sql){
 const originalFunctions=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('kind',p.prokind,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),
   'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),
   'comment',obj_description(p.oid,'pg_proc')) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prokind IN ('f','p');`,'tryvit_recovery_operator','journal_functions'));
 const sequences=JSON.parse(sql(sequencesSql(),'tryvit_recovery_operator','journal_sequences'));
 const columnComments=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('name',a.attname,'comment',col_description(a.attrelid,a.attnum)) ORDER BY a.attname)
  FROM pg_attribute a WHERE a.attrelid='public.v_master'::regclass AND a.attname IN ('allergen_count','allergen_tags','trace_count','trace_tags');`,
  'tryvit_recovery_operator','journal_column_comments'));
 const hashes=Object.fromEntries([...TABLES,'product_change_log','mv_refresh_log'].map(t=>[t,JSON.parse(sql(
   TABLES.includes(t)?fingerprintQuery(t):`SELECT jsonb_build_object('count',count(*),'rowSha256',encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),''),'UTF8')),'hex')) FROM public.${q(t)} t`,
   'tryvit_recovery_operator','journal_hash'))]));
 const structure=JSON.parse(sql(SCHEMA_QUERIES.schema,'tryvit_recovery_operator','journal_schema'));
 const functions=JSON.parse(sql(SCHEMA_QUERIES.functions,'tryvit_recovery_operator','journal_function_hashes'));
 const rls=JSON.parse(sql(SCHEMA_QUERIES.rls,'tryvit_recovery_operator','journal_rls'));
 const normalizedGrants=JSON.parse(sql(NORMALIZED_GRANTS_SQL,'tryvit_recovery_operator','journal_grants'));
 const roles=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('name',rolname) ORDER BY rolname) FROM pg_roles WHERE left(rolname,3)<>'pg_' AND rolname<>'tryvit_recovery_operator';`,'tryvit_recovery_operator','journal_roles'));
 sql('CREATE SCHEMA recovery_journal;\n'+[...TABLES,'product_change_log','mv_refresh_log'].map(t=>
   `CREATE TABLE recovery_journal.${q(t)} AS SELECT * FROM public.${q(t)};`).join('\n'),'tryvit_recovery_operator','journal_tables');
 return {originalFunctions,columnComments,sequences,hashes,structure,functions,rls,normalizedGrants,roles};
}

export function restoreCatchupJournal(sql,journal){
 // Revert the additive allergen wrapper by restoring the original function's
 // identity first; no existing product or private/user row is deleted.
 sql(`DROP TRIGGER IF EXISTS trg_product_allergen_evidence_basis ON public.product_allergen_info;
  DO $rename$ BEGIN IF to_regprocedure('public.get_product_profile_v1_legacy_internal(bigint,text)') IS NOT NULL THEN
    DROP FUNCTION public.api_get_product_profile(bigint,text);
    ALTER FUNCTION public.get_product_profile_v1_legacy_internal(bigint,text) RENAME TO api_get_product_profile;
  END IF; END $rename$;
  ALTER TABLE public.product_allergen_info DROP COLUMN IF EXISTS evidence_basis;`,'tryvit_recovery_operator','inverse_additive_schema');
 const current=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('kind',p.prokind,'signature',p.oid::regprocedure::text))
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p');`,'tryvit_recovery_operator','inverse_routines'));
 const originalSignatures=new Set(journal.originalFunctions.map(f=>f.signature));
 for(const f of current)if(!originalSignatures.has(f.signature))sql(`DROP ${f.kind==='p'?'PROCEDURE':'FUNCTION'} ${f.signature};`,'tryvit_recovery_operator','inverse_added_routine');
 sql(journal.originalFunctions.map(f=>f.definition+';\n'+`ALTER ${f.kind==='p'?'PROCEDURE':'FUNCTION'} public.${q(f.name)}(${f.args}) OWNER TO ${q(f.owner)};
  COMMENT ON ${f.kind==='p'?'PROCEDURE':'FUNCTION'} public.${q(f.name)}(${f.args}) IS ${f.comment===null?'NULL':lit(f.comment)};`).join('\n'),
  'tryvit_recovery_operator','inverse_function_definitions');
 sql(journal.columnComments.map(c=>`COMMENT ON COLUMN public.v_master.${q(c.name)} IS ${c.comment===null?'NULL':lit(c.comment)};`).join('\n'),
   'tryvit_recovery_operator','inverse_column_comments');
 sql(`BEGIN;
  ALTER TABLE public.products DISABLE TRIGGER products_30_change_audit;
  ALTER TABLE public.products DISABLE TRIGGER trg_products_updated_at;
  ALTER TABLE public.ingredient_ref DISABLE TRIGGER trg_ingredient_ref_updated_at;
  ALTER TABLE public.product_allergen_info DISABLE TRIGGER trg_product_allergen_info_updated_at;
  DELETE FROM public.product_ingredient p WHERE NOT EXISTS(SELECT 1 FROM recovery_journal.product_ingredient j
    WHERE j.product_id=p.product_id AND j.ingredient_id=p.ingredient_id AND j.position=p.position);
  DELETE FROM public.product_allergen_info p WHERE NOT EXISTS(SELECT 1 FROM recovery_journal.product_allergen_info j
    WHERE j.product_id=p.product_id AND j.tag=p.tag AND j.type=p.type);
  DELETE FROM public.ingredient_ref p WHERE NOT EXISTS(SELECT 1 FROM recovery_journal.ingredient_ref j WHERE j.ingredient_id=p.ingredient_id);
  UPDATE public.ingredient_ref p SET concern_tier=j.concern_tier,is_additive=j.is_additive,concern_reason=j.concern_reason,updated_at=j.updated_at
    FROM recovery_journal.ingredient_ref j WHERE p.ingredient_id=j.ingredient_id;
  UPDATE public.products p SET ingredient_concern_score=j.ingredient_concern_score,updated_at=j.updated_at FROM recovery_journal.products j WHERE p.product_id=j.product_id;
  UPDATE public.product_allergen_info p SET updated_at=j.updated_at FROM recovery_journal.product_allergen_info j
    WHERE p.product_id=j.product_id AND p.tag=j.tag AND p.type=j.type;
  DELETE FROM public.product_change_log p WHERE NOT EXISTS(SELECT 1 FROM recovery_journal.product_change_log j WHERE j.id=p.id);
  DELETE FROM public.mv_refresh_log p WHERE NOT EXISTS(SELECT 1 FROM recovery_journal.mv_refresh_log j WHERE j.refresh_id=p.refresh_id);
  ALTER TABLE public.products ENABLE TRIGGER products_30_change_audit;
  ALTER TABLE public.products ENABLE TRIGGER trg_products_updated_at;
  ALTER TABLE public.ingredient_ref ENABLE TRIGGER trg_ingredient_ref_updated_at;
  ALTER TABLE public.product_allergen_info ENABLE TRIGGER trg_product_allergen_info_updated_at;
  COMMIT;`,'tryvit_recovery_operator','inverse_catalog_delta');
 for(const [sequence,state] of Object.entries(journal.sequences))sql(`SELECT setval('public.${sequence}',${state.lastValue}::bigint,${state.isCalled});`,
   'tryvit_recovery_operator','inverse_sequence');
 sql(restoreCapturedGrants(journal.normalizedGrants,{roles:journal.roles,database:{owner:'postgres'}},journal.structure).join('\n'),
   'tryvit_recovery_operator','inverse_grants');
 for(const table of Object.keys(journal.hashes)){
  const value=JSON.parse(sql(TABLES.includes(table)?fingerprintQuery(table):
    `SELECT jsonb_build_object('count',count(*),'rowSha256',encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),''),'UTF8')),'hex')) FROM public.${q(table)} t`,
    'tryvit_recovery_operator','inverse_hash'));
  check(equal(value,journal.hashes[table]),'inverse_value_mismatch_'+table);
 }
 check(equal(JSON.parse(sql(sequencesSql(),'tryvit_recovery_operator','inverse_sequence_check')),journal.sequences),'inverse_sequence_state_mismatch');
 sql('DROP SCHEMA recovery_journal CASCADE;','tryvit_recovery_operator','remove_local_journal');
 check(equal(canonicalStructure(JSON.parse(sql(SCHEMA_QUERIES.schema,'tryvit_recovery_operator','inverse_schema_check'))),canonicalStructure(journal.structure)),
   'inverse_structure_mismatch');
 check(equal(canonicalGrantRows(JSON.parse(sql(NORMALIZED_GRANTS_SQL,'tryvit_recovery_operator','inverse_grant_check'))),canonicalGrantRows(journal.normalizedGrants)),
   'inverse_grant_mismatch');
 check(equal(JSON.parse(sql(SCHEMA_QUERIES.functions,'tryvit_recovery_operator','inverse_function_check')),journal.functions),'inverse_function_mismatch');
 check(equal(JSON.parse(sql(SCHEMA_QUERIES.rls,'tryvit_recovery_operator','inverse_rls_check')),journal.rls),'inverse_rls_mismatch');
 for(const view of views)sql(`REFRESH MATERIALIZED VIEW public.${view};`,'postgres','inverse_cache_rebuild');
 return {result:'PASS',catalogTableHashes:TABLES.length,operationalAuditHashes:2,sequenceStates:seqs.length,
   originalProductRowsDeleted:false,privateRowsRestored:false,scope:'isolated-ten-catchup-inverse-catalog-schema-audit-sequences',
   cacheDisposition:'recomputed-not-original-cache-bytes',requiresQuiescentRealStagingWindow:true};
}
export function lintForwardSchemas(sql){
 return JSON.parse(sql(String.raw`BEGIN;
  CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA public;
  SET LOCAL ROLE postgres;
  WITH schemas AS (
   SELECT pn.nspname FROM pg_namespace pn LEFT JOIN pg_depend pd ON pd.objid=pn.oid
   WHERE pd.deptype IS NULL AND NOT pn.nspname LIKE ANY(ARRAY[
    'information\_schema','pg\_%','\_analytics','\_realtime','\_supavisor','pgbouncer','pgmq','pgsodium','pgtle','supabase\_migrations','vault'])
    AND pn.nspowner::regrole::text<>'supabase_admin'
  ), functions AS (
   SELECT p.oid,n.nspname,p.proname FROM pg_namespace n JOIN pg_proc p ON p.pronamespace=n.oid JOIN pg_language l ON p.prolang=l.oid
   WHERE l.lanname='plpgsql' AND p.prorettype<>2279 AND n.nspname IN (SELECT nspname FROM schemas)
  ), issues AS (
   SELECT f.nspname||'.'||f.proname AS routine,i AS issue FROM functions f
   CROSS JOIN LATERAL public.plpgsql_check_function(f.oid,format:='json') report
   CROSS JOIN LATERAL jsonb_array_elements(report::jsonb->'issues') i
  ) SELECT jsonb_build_object('method','Supabase CLI v2.111.0 equivalent whole-user-schema lint',
   'checkedFunctions',(SELECT count(*) FROM functions),
   'errors',(SELECT COALESCE(jsonb_agg(jsonb_build_object('function',routine,'sqlState',issue->>'sqlState'))
     FILTER(WHERE issue->>'level' LIKE 'error%'),'[]'::jsonb) FROM issues),
   'warningCount',(SELECT count(*) FROM issues WHERE issue->>'level' LIKE 'warning%'));
  ROLLBACK;`,'tryvit_recovery_operator','forward_lint'));
}
