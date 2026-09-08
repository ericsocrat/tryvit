/** Read-only metadata supplement. No table rows, credentials or SQL are printed. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readToken,managementSql,NORMALIZED_GRANTS_SQL} from './staging-read-capture.mjs';
import {captureDirectory} from './staging-reconstruct.mjs';
import {dpapi,encryptBytes,decryptBytes} from './opaque-containment.mjs';
import {SCHEMA_QUERIES} from './schema-catalog-recovery.mjs';
import {TABLES,fingerprintQuery} from './catalog-recovery.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const value=x=>Object.values(x[0])[0];
const schemas="('auth','storage','realtime','supabase_migrations','graphql_public','pgbouncer','extensions')";
export const MANAGED_DDL_SQL=`SELECT jsonb_build_object(
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner)) ORDER BY nspname)
   FROM pg_namespace WHERE nspname IN ${schemas}),
 'types',(SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'kind',t.typtype,
   'labels',(SELECT jsonb_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid=t.oid),
   'attributes',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) ORDER BY a.attnum)
     FROM pg_attribute a WHERE a.attrelid=t.typrelid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname,t.typname),'[]'::jsonb)
   FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace LEFT JOIN pg_class c ON c.oid=t.typrelid
   WHERE n.nspname IN ${schemas} AND (t.typtype='e' OR (t.typtype='c' AND c.relkind='c'))
   AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')),
 'sequences',(SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),
   'type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,'minimum',s.seqmin::text,
   'maximum',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle) ORDER BY n.nspname,c.relname),'[]'::jsonb)
   FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ${schemas}),
 'partitions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'partition',c.relispartition,
   'parent',(SELECT inhparent::regclass::text FROM pg_inherits WHERE inhrelid=c.oid LIMIT 1),
   'bound',pg_get_expr(c.relpartbound,c.oid),'key',pg_get_partkeydef(c.oid)) ORDER BY n.nspname,c.relname),'[]'::jsonb)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ${schemas} AND (c.relispartition OR c.relkind='p')),
 'functions',(SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),
   'owner',pg_get_userbyid(p.proowner),'definition',pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ${schemas} AND p.prokind IN ('f','p')
   AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'))
) AS metadata;`;
export async function captureManagedMetadata(leaf){
 const directory=captureDirectory(leaf),key=dpapi('unprotect',fs.readFileSync(path.join(directory,'key.dpapi')));
 try{
  const existing=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,'metadata.enc')),key)),token=readToken();
  for(const kind of ['schema','functions','rls']){
   const fresh=await managementSql(token,SCHEMA_QUERIES[kind],'supplement_verify');
   if(hash(fresh)!==hash(existing.preCaptureMetadata.structure[kind]))throw Error('source_metadata_changed');
  }
  const supplement=value(await managementSql(token,MANAGED_DDL_SQL,'supplement_capture'));
  const currentGrants=await managementSql(token,NORMALIZED_GRANTS_SQL,'supplement_verify');
  if(hash(currentGrants)!==hash(existing.preCaptureMetadata.normalizedGrants))throw Error('source_grants_changed');
  const leafName='managed-metadata-'+Date.now()+'.enc';
  fs.writeFileSync(path.join(directory,leafName),encryptBytes(Buffer.from(JSON.stringify(supplement)),key));
  return {result:'METADATA_CAPTURED_NOT_RESTORED',captureDirectoryLeaf:leaf,supplementLeaf:leafName,sha256:hash(supplement),
    privateRowsExported:false,remoteWrites:false};
 }finally{key.fill(0);}
}
export async function captureRecoveryState(leaf){
 const directory=captureDirectory(leaf),key=dpapi('unprotect',fs.readFileSync(path.join(directory,'key.dpapi')));
 try {
  const original=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,'metadata.enc')),key));
  const query=`SELECT jsonb_build_object('catalog',jsonb_build_object(${TABLES.map(t=>"'"+t+"',("+fingerprintQuery(t)+')').join(',')}),
    'triggerModes',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'mode',t.tgenabled) ORDER BY c.relname,t.tgname)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('products','ingredient_ref','product_ingredient','product_allergen_info','product_change_log','mv_refresh_log') AND NOT t.tgisinternal),
    'productChangeCount',(SELECT count(*) FROM public.product_change_log),
    'mvRefreshRows',(SELECT COALESCE(jsonb_agg(jsonb_build_object('refresh_id',refresh_id::text,'mv_name',mv_name,
      'refreshed_at',refreshed_at,'duration_ms',duration_ms,'row_count',row_count::text,'triggered_by',triggered_by) ORDER BY refresh_id),'[]'::jsonb)
      FROM public.mv_refresh_log)) AS state;`;
  const state=value(await managementSql(readToken(),query,'state_capture'));
  if(state.productChangeCount!==0)throw Error('historical_actor_rows_require_separate_scope');
  if(!state.mvRefreshRows.every(row=>['manual','post_pipeline','scheduled','api','migration'].includes(row.triggered_by)))
    throw Error('refresh_trigger_value_outside_nonidentity_allowlist');
  if(JSON.stringify(state.mvRefreshRows.map(r=>r.refresh_id))!==JSON.stringify(original.auditKeys.mvRefreshIds))throw Error('refresh_rows_changed_since_capture');
  const file='recovery-state-'+Date.now()+'.enc';
  fs.writeFileSync(path.join(directory,file),encryptBytes(Buffer.from(JSON.stringify(state)),key));
  return {result:'STATE_VERIFICATION_CAPTURED_NOT_RESTORED',captureDirectoryLeaf:leaf,supplementLeaf:file,
    catalogTables:TABLES.length,mvRefreshRows:state.mvRefreshRows.length,historicalActorRowsExported:0,remoteWrites:false};
 }finally{key.fill(0);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length!==2||!['--capture','--recovery-state'].includes(args[0]))throw Error('explicit_capture_leaf_required');
 (args[0]==='--capture'?captureManagedMetadata:captureRecoveryState)(args[1]).then(x=>console.log(JSON.stringify(x))).catch(()=>{console.error(JSON.stringify({result:'HOLD',code:'managed_metadata_capture_failed'}));process.exitCode=1;});
}
