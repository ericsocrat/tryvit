/** Reviewed execute gate required. Captures and credentials remain private. */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes,createHash,createHmac,pbkdf2Sync} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {TABLES,SqlSession,privateDirectory,RecoveryError} from './catalog-recovery.mjs';
import {encryptBytes,dpapi} from './opaque-containment.mjs';
import {SCHEMA_QUERIES} from './schema-catalog-recovery.mjs';
import {PROJECT,makePlan,METADATA_SQL,validateMetadata} from './staging-catchup-plan.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BIN='C:/Program Files/PostgreSQL/18/bin';
const SEQUENCES=['ingredient_ref_ingredient_id_seq','products_product_id_seq','product_images_image_id_seq','freshness_policies_id_seq',
  'product_change_log_id_seq','mv_refresh_log_refresh_id_seq'];
const check=(condition,code)=>{if(!condition)throw new RecoveryError(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const literal=value=>"'"+value.replaceAll("'","''")+"'";
export function catalogDumpArgs(schemaOnly) {
  check(typeof schemaOnly==='boolean','invalid_capture_dump_scope');
  return [schemaOnly?'--schema-only':'--data-only',...TABLES.flatMap(table=>['--table','public.'+table])];
}
export function classifyDumpFailure(stderr,phase) {
  check(['schema','catalog'].includes(phase),'invalid_dump_phase');
  const text=String(stderr||'');
  const kind=/permission denied/iu.test(text)?'permission':/must be owner/iu.test(text)?'ownership':
    /lock timeout|canceling statement due to lock|could not obtain lock/iu.test(text)?'lock':
    /snapshot/iu.test(text)?'snapshot':/certificate|SSL|TLS/iu.test(text)?'tls':
    /authentication failed/iu.test(text)?'authentication':'native';
  // Parse only to classify into fixed labels. Never return any identifier,
  // statement, data value or raw diagnostic supplied by the remote server.
  let category='unspecified';
  if(/LOCK TABLE[^\n]*\bauth\./iu.test(text))category='includes_auth';
  else if(/LOCK TABLE[^\n]*\bstorage\./iu.test(text))category='includes_storage';
  else {
    const sequence=text.match(/permission denied for sequence "?([a-z][a-z0-9_]*)"?/iu)?.[1];
    if(sequence)category=SEQUENCES.includes(sequence)?'approved_sequence':'unapproved_sequence';
    const table=text.match(/permission denied for (?:table|relation) "?([a-z][a-z0-9_]*)"?/iu)?.[1];
    if(table)category=TABLES.includes(table)?'approved_catalog':'unapproved_relation';
  }
  return `staging_${phase}_dump_${kind}_${category}`;
}
export function ownedRole(value) {check(/^tryvit_stage_capture_[a-f0-9]{24}$/u.test(value),'invalid_capture_role');return '"'+value+'"';}
export function repositoryEnvPath(commonDirectory,remote) {
  check(path.basename(commonDirectory)==='.git' && /^(?:https:\/\/github\.com\/|git@github\.com:)ericsocrat\/tryvit(?:\.git)?$/u.test(remote),'unapproved_credential_repository');
  return path.resolve(commonDirectory,'../.env');
}
export function readToken(envFile,environment=process.env) {
  if(environment.SUPABASE_ACCESS_TOKEN) {
    check(/^sbp_[a-zA-Z0-9]+$/u.test(environment.SUPABASE_ACCESS_TOKEN),'unsupported_management_token_format');
    return environment.SUPABASE_ACCESS_TOKEN;
  }
  const git=args=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',windowsHide:true}).trim();
  const primary=repositoryEnvPath(git(['rev-parse','--path-format=absolute','--git-common-dir']),git(['remote','get-url','origin']));
  envFile=envFile??primary;
  check(path.resolve(envFile)===primary && fs.realpathSync(envFile)===primary,'unapproved_token_file');
  const line=fs.readFileSync(envFile,'utf8').split(/\r?\n/u).find(v=>/^\s*SUPABASE_ACCESS_TOKEN\s*=/u.test(v));
  check(line,'staging_management_token_unavailable');
  let token=line.slice(line.indexOf('=')+1).trim();
  if((token.startsWith('"')&&token.endsWith('"'))||(token.startsWith("'")&&token.endsWith("'")))token=token.slice(1,-1);
  check(/^sbp_[a-zA-Z0-9]+$/u.test(token),'unsupported_management_token_format');
  return token;
}
export function scramVerifier(password,salt=randomBytes(16)) {
  const salted=pbkdf2Sync(password,salt,4096,32,'sha256');
  const client=createHmac('sha256',salted).update('Client Key').digest();
  const stored=createHash('sha256').update(client).digest('base64');
  const server=createHmac('sha256',salted).update('Server Key').digest('base64');
  return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${stored}:${server}`;
}
export function createRoleSql(role,verifier,expires) {
  const name=ownedRole(role);
  check(/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/u.test(verifier),'invalid_scram_verifier');
  check(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(expires),'invalid_role_expiry');
  return `BEGIN; CREATE ROLE ${name} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT BYPASSRLS
    CONNECTION LIMIT 3 PASSWORD ${literal(verifier)} VALID UNTIL ${literal(expires)};
    ALTER ROLE ${name} SET default_transaction_read_only=on;
    ALTER ROLE ${name} SET statement_timeout='90s';
    ALTER ROLE ${name} SET idle_in_transaction_session_timeout='180s';
    GRANT CONNECT ON DATABASE postgres TO ${name};
    GRANT USAGE ON SCHEMA public,extensions,supabase_migrations TO ${name};
    GRANT SELECT ON ${TABLES.map(t=>'public.'+t).join(',')} TO ${name};
    GRANT SELECT ON public.${SEQUENCES.join(',public.')} TO ${name};
    GRANT SELECT(version) ON supabase_migrations.schema_migrations TO ${name};
    GRANT SELECT(id) ON public.product_change_log TO ${name};
    GRANT SELECT(refresh_id) ON public.mv_refresh_log TO ${name};
    COMMIT;`;
}
export function cleanupRoleSql(role,oid) {
  const name=ownedRole(role);check(/^\d+$/u.test(String(oid)),'invalid_owned_role_oid');
  // No broad DROP OWNED, CASCADE, CLI-role deletion, or other role mutation.
  return `DO $cleanup$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${literal(role)}) THEN RETURN; END IF;
    IF (SELECT oid FROM pg_roles WHERE rolname=${literal(role)})<>${oid}::oid THEN RAISE EXCEPTION 'capture_role_oid_changed'; END IF;
    IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE usesysid=${oid}::oid) THEN RAISE EXCEPTION 'capture_sessions_remain'; END IF;
    REVOKE ALL ON DATABASE postgres FROM ${name};
    REVOKE ALL ON SCHEMA public,extensions,supabase_migrations FROM ${name};
    REVOKE ALL ON ${TABLES.map(t=>'public.'+t).join(',')} FROM ${name};
    REVOKE ALL ON public.${SEQUENCES.join(',public.')} FROM ${name};
    REVOKE SELECT(version) ON supabase_migrations.schema_migrations FROM ${name};
    REVOKE SELECT(id) ON public.product_change_log FROM ${name};
    REVOKE SELECT(refresh_id) ON public.mv_refresh_log FROM ${name};
    DROP ROLE ${name}; END $cleanup$;`;
}
export function drainRoleSql(role,oid) {
  const name=ownedRole(role);check(/^\d+$/u.test(String(oid)),'invalid_owned_role_oid');
  return `DO $drain$ DECLARE owned_backend record; BEGIN
    IF current_user<>'postgres' OR NOT pg_has_role(current_user,'pg_signal_backend','USAGE')
      OR NOT pg_has_role(current_user,'pg_read_all_stats','USAGE') THEN
      RAISE EXCEPTION 'capture_signal_permission_missing'; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${literal(role)} AND oid=${oid}::oid AND NOT rolsuper) THEN
      RAISE EXCEPTION 'capture_role_identity_changed'; END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=${oid}::oid
      AND member=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND admin_option) THEN
      RAISE EXCEPTION 'capture_role_admin_missing'; END IF;
    ALTER ROLE ${name} NOLOGIN;
    FOR owned_backend IN SELECT pid,backend_start FROM pg_stat_activity
      WHERE usesysid=${oid}::oid AND pid<>pg_backend_pid()
    LOOP
      IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=owned_backend.pid
        AND usesysid=${oid}::oid AND backend_start=owned_backend.backend_start AND pid<>pg_backend_pid()) THEN
        PERFORM pg_terminate_backend(owned_backend.pid);
      END IF;
    END LOOP;
    END $drain$;`;
}
export async function drainOwnedRole(sql,role,oid,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  await sql(drainRoleSql(role,oid),'cleanup_drain');
  for(let attempt=0;attempt<20;attempt++) {
    const rows=await sql(`SELECT count(*)::integer AS remaining FROM pg_stat_activity WHERE usesysid=${oid}::oid;`,'cleanup_wait');
    if(rows[0]?.remaining===0)return;
    await sleep(250);
  }
  throw new RecoveryError('capture_owned_backend_drain_timeout');
}
export async function closeOwnedSession(session,timeoutMs=5000) {
  let closeFailure;
  try {await session.close();} catch(error){closeFailure=error;session.child.kill();}
  if(session.child.exitCode===null)await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{session.child.kill();reject(new RecoveryError('capture_client_exit_unproven'));},timeoutMs);
    session.child.once('exit',()=>{clearTimeout(timer);resolve();});
  });
  if(closeFailure)throw closeFailure;
}
export const AUTHORITY_SQL=`SELECT jsonb_build_object(
  'database',(SELECT jsonb_build_object('name',datname,'owner',pg_get_userbyid(datdba),'acl',datacl::text,
    'encoding',pg_encoding_to_char(encoding),'collation',datcollate,'ctype',datctype) FROM pg_database WHERE datname=current_database()),
  'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,
    'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls) ORDER BY rolname)
    FROM pg_roles WHERE left(rolname,3)<>'pg_'),
  'memberships',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'grantor',g.rolname,
    'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,m.rolname,g.rolname)
    FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member JOIN pg_roles g ON g.oid=a.grantor),
  'extensions',(SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion) ORDER BY extname) FROM pg_extension)) AS authority;`;
// Interpret PostgreSQL ACL defaults rather than comparing NULL with its expanded
// equivalent. Include column/database ACLs touched by the capture role as well.
export const NORMALIZED_GRANTS_SQL=`WITH source(value) AS (${SCHEMA_QUERIES.grants}), entries AS (
  SELECT e.* FROM source CROSS JOIN LATERAL jsonb_to_recordset(source.value) AS e(kind text,schema text,name text,acl text)
), resolved AS (
  SELECT e.*,CASE e.kind
    WHEN 'relation' THEN (SELECT c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=e.schema AND c.relname=e.name)
    WHEN 'function' THEN (SELECT p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=e.schema AND p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=e.name)
    WHEN 'schema' THEN (SELECT nspowner FROM pg_namespace WHERE nspname=e.name) END AS owner,
    CASE e.kind WHEN 'relation' THEN CASE WHEN EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=e.schema AND c.relname=e.name AND c.relkind='S') THEN 's' ELSE 'r' END
      WHEN 'function' THEN 'f' WHEN 'schema' THEN 'n' END AS aclkind FROM entries e
), raw AS (
  SELECT kind,schema,name,COALESCE(acl::aclitem[],acldefault(aclkind::"char",owner),'{}'::aclitem[]) AS acl FROM resolved
  UNION ALL SELECT 'database','',datname,COALESCE(datacl,acldefault('d',datdba)) FROM pg_database WHERE datname=current_database()
  UNION ALL SELECT 'column',n.nspname,c.relname||'.'||a.attname,COALESCE(a.attacl,'{}'::aclitem[])
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE a.attnum>0 AND NOT a.attisdropped AND n.nspname IN ('public','supabase_migrations') AND c.relkind IN ('r','p')
) SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',kind,'schema',schema,'name',name,'grants',
  COALESCE((SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),
    'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,
    'privilege',x.privilege_type,'grantable',x.is_grantable)
    ORDER BY x.grantor,x.grantee,x.privilege_type) FROM aclexplode(CASE WHEN cardinality(raw.acl)>0 THEN raw.acl ELSE NULL END) x),'[]'::jsonb))
  ORDER BY kind,schema,name),'[]'::jsonb) AS grants FROM raw;`;
export async function managementSql(token,query,phase='metadata',request=fetch) {
  check(/^[a-z_]+$/u.test(phase),'invalid_management_phase');
  let response;
  try {response=await request(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`,{
    method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(90000)});
  } catch {throw new RecoveryError('staging_'+phase+'_network_failed');}
  check(response.ok,'staging_'+phase+'_http_'+response.status);
  try {return await response.json();} catch {throw new RecoveryError('staging_'+phase+'_invalid_json');}
}
export async function withOwnedRole({role,verifier,expires,sql,capture}) {
  let attempted=false,oid,outcome,primaryFailure,cleanupFailure;
  try {
    const pre=await sql(`SELECT current_user AS actor, EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${literal(role)}) AS exists;`,'role_preflight');
    check(pre[0]?.actor==='postgres'&&pre[0]?.exists===false,'capture_actor_or_role_precondition');
    attempted=true;await sql(createRoleSql(role,verifier,expires),'role_create');
    const found=await sql(`SELECT oid::text AS oid FROM pg_roles WHERE rolname=${literal(role)};`,'role_identity');
    check(found.length===1,'created_capture_role_missing');oid=found[0].oid;
    outcome=await capture();
  } catch(error){primaryFailure=error;}
  try {
    if(attempted) {
      // Recover ownership after an ambiguous network response to CREATE.
      if(!oid){const found=await sql(`SELECT oid::text AS oid FROM pg_roles WHERE rolname=${literal(role)};`,'cleanup_identity');oid=found[0]?.oid;}
      if(oid){await drainOwnedRole(sql,role,oid);await sql(cleanupRoleSql(role,oid),'cleanup_drop');}
      const after=await sql(`SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${literal(role)}) AS exists;`,'cleanup_verify');
      check(after[0]?.exists===false,'capture_role_cleanup_unproven');
    }
  } catch(error){cleanupFailure=error;}
  if(primaryFailure||cleanupFailure) {
    const failure=primaryFailure||cleanupFailure;
    if(cleanupFailure)failure.cleanupCode=cleanupFailure instanceof RecoveryError?cleanupFailure.code:'cleanup_failed';
    throw failure;
  }
  return outcome;
}
export async function captureStaging({execute=false,ca}={}) {
  const plan=makePlan();
  if(!execute)return {result:'PREPARED_NOT_EXECUTED',projectRef:PROJECT,temporaryRoleCreated:false,
    staticPasswordRequired:false,captureProven:false,requires:['root-review','verified-tls-ca','staging-pat-query-authority'],migrationSetSha256:plan.migrationSetSha256};
  check(ca&&fs.existsSync(ca),'verified_staging_tls_ca_required');
  const token=readToken(),role='tryvit_stage_capture_'+randomBytes(12).toString('hex');
  const password=randomBytes(32).toString('base64url'),expires=new Date(Date.now()+15*60*1000).toISOString();
  const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP,
    PGHOST:'aws-1-eu-west-1.pooler.supabase.com',PGPORT:'5432',PGUSER:role+'.'+PROJECT,PGDATABASE:'postgres',PGPASSWORD:password,
    PGSSLMODE:'verify-full',PGSSLROOTCERT:path.resolve(ca),PGCONNECT_TIMEOUT:'10',PGCLIENTENCODING:'UTF8',
    PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=90000'};
  const sql=(query,phase)=>managementSql(token,query,phase);
  const preCaptureMetadata={checkedAt:new Date().toISOString(),authority:await sql(AUTHORITY_SQL),structure:{},fingerprints:{}};
  for(const [kind,query] of Object.entries(SCHEMA_QUERIES)) {
    preCaptureMetadata.structure[kind]=await sql(query);
    preCaptureMetadata.fingerprints[kind]=hash(JSON.stringify(preCaptureMetadata.structure[kind]));
  }
  preCaptureMetadata.normalizedGrants=await sql(NORMALIZED_GRANTS_SQL);
  const report=await withOwnedRole({role,verifier:scramVerifier(password),expires,sql,capture:async()=>{
    const session=new SqlSession(path.join(BIN,'psql.exe'),['-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],env);
    let captureFailure;
    try {
      await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const mode=JSON.parse(await session.query("SELECT jsonb_build_object('readonly',current_setting('transaction_read_only'),'user',session_user)"));
      check(mode.readonly==='on'&&mode.user===role,'capture_session_boundary_invalid');
      const metadata=JSON.parse(await session.query(METADATA_SQL));validateMetadata(plan,metadata);
      const columns=JSON.parse(await session.query(`SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name)) FROM information_schema.columns
        WHERE table_schema='public' AND table_name IN (${TABLES.map(literal).join(',')})`));
      check(new Set(columns.map(c=>c.table)).size===TABLES.length,'capture_catalog_table_missing');
      for(const c of columns.filter(c=>/(?:reviewed|verified|created|updated|approved|submitted|uploaded)_by$|(?:^|_)(?:user|owner|actor|customer|patient)_id$|email|password|secret|token/iu.test(c.column))) {
        check(/^[a-z][a-z0-9_]*$/u.test(c.column)&&TABLES.includes(c.table),'capture_identifier_invalid');
        check(Number(await session.query(`SELECT count(*) FROM public.${c.table} WHERE "${c.column}" IS NOT NULL`))===0,'catalog_private_column_nonempty');
      }
      check(Number(await session.query("SELECT count(*) FROM public.product_images WHERE source IS DISTINCT FROM 'off_api'"))===0,'catalog_image_source_unreviewed');
      check(Number(await session.query("SELECT count(*) FROM public.data_sources WHERE metadata IS NOT NULL AND metadata<>'{}'::jsonb"))===0,'catalog_source_metadata_unreviewed');
      const snapshot=await session.query('SELECT pg_export_snapshot()');check(/^[0-9A-F-]+$/u.test(snapshot),'snapshot_invalid');
      const dump=(args,phase)=>{
        const result=spawnSync(path.join(BIN,'pg_dump.exe'),['--format=custom','--no-large-objects','--snapshot='+snapshot,...args],
          {env,encoding:null,maxBuffer:128*1024*1024,timeout:120000,windowsHide:true});
        check(result.status===0,classifyDumpFailure(result.stderr?.toString(),phase));return result.stdout;
      };
      const schema=dump(catalogDumpArgs(true),'schema');
      const catalog=dump(catalogDumpArgs(false),'catalog');
      const auditKeys=JSON.parse(await session.query(`SELECT jsonb_build_object('productChangeIds',
        (SELECT COALESCE(jsonb_agg(id::text ORDER BY id),'[]'::jsonb) FROM public.product_change_log),
        'mvRefreshIds',(SELECT COALESCE(jsonb_agg(refresh_id::text ORDER BY refresh_id),'[]'::jsonb) FROM public.mv_refresh_log))`));
      fs.mkdirSync(path.join(ROOT,'backups'),{recursive:true});
      const directory=path.join(ROOT,'backups','staging_capture_'+Date.now()+'_'+randomBytes(4).toString('hex'));privateDirectory(directory);
      const key=randomBytes(32);fs.writeFileSync(path.join(directory,'key.dpapi'),dpapi('protect',key));
      for(const [name,bytes] of [['schema',schema],['catalog',catalog],['metadata',Buffer.from(JSON.stringify({plan,metadata,auditKeys,expires,
        preCaptureMetadata,captureRole:role,captureGrantOverlayRequiresRemoval:true}))]])
        fs.writeFileSync(path.join(directory,name+'.enc'),encryptBytes(bytes,key));
      key.fill(0);
      return {result:'CAPTURED_NOT_RESTORED',method:'selected-catalog-backup-plus-live-structural-metadata',
        schemaArchiveScope:'fifteen-selected-catalog-tables-only',schemaReconstructionRequired:true,
        projectRef:PROJECT,captureDirectoryLeaf:path.basename(directory),migrationSetSha256:plan.migrationSetSha256,
        schemaSha256:hash(schema),catalogSha256:hash(catalog),privateRowsExported:false,recoveryProven:false,
        temporaryRoleCleanup:'checked-before-return',limitations:['no-restore-or-rollback-proof','audit-identities-excluded','managed-services-excluded',
          'schema-archive-contains-owned-capture-grant-overlay-use-pre-capture-authority']};
    } catch(error){captureFailure=error;throw error;}
    finally {try {await closeOwnedSession(session);} catch(error){
      if(captureFailure)captureFailure.clientCleanupCode=error instanceof RecoveryError?error.code:'client_cleanup_failed';
      else throw error;
    }}
  }});
  const postCaptureGrants=await sql(NORMALIZED_GRANTS_SQL);
  check(JSON.stringify(preCaptureMetadata.normalizedGrants)===JSON.stringify(postCaptureGrants),'capture_grant_restore_equality_unproven');
  return {...report,sourceGrantMetadataRestored:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),caIndex=args.indexOf('--source-ca');
  captureStaging({execute:args.includes('--execute'),ca:caIndex<0?undefined:args[caIndex+1]})
    .then(report=>console.log(JSON.stringify(report)))
    .catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'staging_capture_failed',
      cleanupCode:/^[a-z0-9_]+$/u.test(error.cleanupCode||'')?error.cleanupCode:undefined,
      clientCleanupCode:/^[a-z0-9_]+$/u.test(error.clientCleanupCode||'')?error.clientCleanupCode:undefined,recoveryProven:false}));process.exitCode=1;});
}
