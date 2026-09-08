/** Opaque SCHEMA-only export plus approved catalog rows. No private-row export. */
import {spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scopeTables,validateScopeMetadata,SqlSession,command,fingerprintQuery,privateDirectory,readPassword,RecoveryError} from './catalog-recovery.mjs';
import {IMAGE,assertContained,containmentArgs,dpapi,encryptBytes,decryptBytes} from './opaque-containment.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const BIN='C:/Program Files/PostgreSQL/18/bin';
const hash=value=>createHash('sha256').update(value).digest('hex');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const OPERATOR='tryvit_recovery_operator';
export const rolesQuery=`SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,
  'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls)
  ORDER BY rolname) FROM pg_roles WHERE left(rolname,3)<>'pg_' AND rolname<>'${OPERATOR}'`;
export const membershipsQuery=`SELECT COALESCE(jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,
  'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) ORDER BY r.rolname,m.rolname),'[]'::jsonb)
  FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member`;
export const supplementQuery=`SELECT jsonb_build_object('definition',pg_get_functiondef(p.oid),
  'arguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,
  'extension',e.extname,'extensionVersion',e.extversion,
  'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) ORDER BY nspname)
    FROM pg_namespace WHERE nspname IN ('graphql','graphql_public')))
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
  JOIN pg_extension e ON e.oid=d.refobjid
  WHERE n.nspname='graphql_public' AND p.proname='graphql' AND e.extname='pg_graphql'`;
const excludedSchemas="('pg_catalog','information_schema','pg_toast')";
const systemFilter="n.nspname NOT IN "+excludedSchemas+" AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%'";

export const SCHEMA_QUERIES={
  schema:`SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,
    'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
    'view',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid) ELSE NULL END,
    'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated)
      ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),
    'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indrelid=c.oid),
    'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
    'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname,c.relname),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${systemFilter} AND c.relkind IN ('r','p','v','m')
      AND NOT EXISTS(SELECT 1 FROM pg_depend e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid AND e.deptype='e')`,
  functions:`SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),
    'owner',pg_get_userbyid(p.proowner),'sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'))
    ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${systemFilter} AND p.prokind IN ('f','p')
      AND NOT EXISTS(SELECT 1 FROM pg_depend e WHERE e.classid='pg_proc'::regclass AND e.objid=p.oid AND e.deptype='e')`,
  grants:`SELECT COALESCE(jsonb_agg(v ORDER BY v->>'kind',v->>'schema',v->>'name'),'[]'::jsonb) FROM (
    SELECT jsonb_build_object('kind','relation','schema',n.nspname,'name',c.relname,'acl',c.relacl::text) v
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${systemFilter} AND c.relkind IN ('r','p','v','m','S')
        AND NOT EXISTS(SELECT 1 FROM pg_depend e WHERE e.classid='pg_class'::regclass AND e.objid=c.oid AND e.deptype='e')
    UNION ALL SELECT jsonb_build_object('kind','function','schema',n.nspname,'name',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','acl',p.proacl::text)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${systemFilter} AND p.prokind IN ('f','p')
        AND NOT EXISTS(SELECT 1 FROM pg_depend e WHERE e.classid='pg_proc'::regclass AND e.objid=p.oid AND e.deptype='e')
    UNION ALL SELECT jsonb_build_object('kind','schema','schema',n.nspname,'name',n.nspname,'acl',n.nspacl::text)
      FROM pg_namespace n WHERE ${systemFilter}
    UNION ALL SELECT jsonb_build_object('kind','default','schema',COALESCE(n.nspname,''),
      'name',pg_get_userbyid(d.defaclrole)||':'||d.defaclobjtype::text,'acl',d.defaclacl::text)
      FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
  ) acl`,
  rls:`SELECT COALESCE(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,
    'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) ORDER BY schemaname,tablename,policyname),'[]'::jsonb)
    FROM pg_policies WHERE schemaname NOT IN ${excludedSchemas}`,
};
export function assertSchemaOnlyArgs(args) {
  if(!args.includes('--schema-only')||args.some(a=>/^(--data-only|--create|--file|--clean|--section|--large-objects)(=|$)/.test(a)))
    throw new RecoveryError('private_row_export_not_authorized');
}
function docker(args,options={}) {return command('docker',args,options);}
function native(name,args,options={}) {return command(path.join(BIN,name+'.exe'),args,options);}
function localSql(name,sql,user=OPERATOR,stage='sql') {
  const result=spawnSync('docker',['exec','-i',name,'psql','-h','/tmp','-U',user,'-d','postgres','-X','-qAt',
    '-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{input:sql+';\n',encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.status!==0)throw new RecoveryError('local_'+stage+'_'+(result.stderr?.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5})\b/)?.[1]||'native'));
  return result.stdout;
}
function processOpaque(executable,args,bytes,env,stage='operation') {
  const result=spawnSync(executable,args,{input:bytes,env,encoding:null,maxBuffer:64*1024*1024});
  if(result.status!==0) {
    const stderr=result.stderr?.toString()||'';
    // Classify only; source SQL, identifiers and credentials never leave memory.
    const kind=/role "pgbouncer" does not exist/.test(stderr)?'pgbouncer_role_missing':
      /unsupported version.*header/.test(stderr)?'archive_version':
      /already exists/.test(stderr)?'object_exists':/extension.*not available/.test(stderr)?'extension_unavailable':
      /could not access file/.test(stderr)?'extension_library':/does not exist/.test(stderr)?
        'dependency_missing_'+(stderr.match(/(?:ERROR:\s+)(role|schema|relation|function|type|operator|database|collation)\b/)?.[1]||'other'):
      /permission denied|must be owner/.test(stderr)?'permission':/unrecognized configuration/.test(stderr)?'server_setting':'native';
    const missingFunction=stderr.match(/ERROR:\s+function ([a-z_][a-z0-9_.]{0,100})\(/)?.[1];
    throw new RecoveryError(`opaque_${stage}_${kind}${missingFunction?'_'+missingFunction:''}_failed`);
  }
  return result.stdout;
}
export function splitBootstrapToc(toc) {
  const lines=toc.split(/\r?\n/);
  const early=line=>/^\d+; \d+ \d+ (SCHEMA|EXTENSION) - /.test(line);
  if(!lines.some(early))throw new RecoveryError('schema_prerequisite_list_missing');
  return {early:lines.filter(line=>early(line)||line.startsWith(';')).join('\n')+'\n',
    remaining:lines.filter(line=>!early(line)).join('\n')+'\n'};
}
export function canonicalStructure(rows) {
  // Catalog index order is not semantics; retain every complete definition.
  return rows.map(row=>({...row,indexes:row.indexes?[...row.indexes].sort():row.indexes}));
}
function canonicalGrants(name,rows) {
  // PostgreSQL itself interprets ACL arrays/defaults. Do not discard grantor,
  // grantee, privilege or grant-option distinctions via ad-hoc string parsing.
  const query=`WITH entries AS (SELECT * FROM jsonb_to_recordset(${literal(JSON.stringify(rows))}::jsonb)
    AS x(kind text,schema text,name text,acl text)), ownership AS (
    SELECT e.*,CASE e.kind
      WHEN 'relation' THEN (SELECT c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=e.schema AND c.relname=e.name)
      WHEN 'function' THEN (SELECT p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=e.schema
        AND p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'=e.name)
      WHEN 'schema' THEN (SELECT n.nspowner FROM pg_namespace n WHERE n.nspname=e.schema)
      ELSE NULL END owner,
      CASE e.kind WHEN 'relation' THEN CASE WHEN EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=e.schema AND c.relname=e.name AND c.relkind='S') THEN 's' ELSE 'r' END
        WHEN 'function' THEN 'f' WHEN 'schema' THEN 'n' ELSE NULL END aclkind FROM entries e)
    SELECT jsonb_agg(jsonb_build_object('kind',e.kind,'schema',e.schema,'name',e.name,'acl',
      (SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',
        CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable)
        ORDER BY pg_get_userbyid(a.grantor) COLLATE "C",CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END COLLATE "C",a.privilege_type COLLATE "C")
        FROM aclexplode(COALESCE(e.acl::aclitem[],acldefault(e.aclkind::"char",e.owner))) a))
      ORDER BY e.kind COLLATE "C",e.schema COLLATE "C",e.name COLLATE "C") FROM ownership e`;
  return JSON.parse(localSql(name,query,OPERATOR,'acl_normalization'));
}
async function captureSupplement({envFile,sourceCa,schemaDirectory}) {
  const directory=path.resolve(schemaDirectory||'');
  if(!directory.startsWith(path.join(ROOT,'backups','schema_catalog_'))||fs.realpathSync(directory)!==directory)
    throw new RecoveryError('schema_archive_not_private');
  const key=dpapi('unprotect',fs.readFileSync(path.join(directory,'schema.key.dpapi')));
  const metadata=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,'metadata.enc')),key));
  const env={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP,
    PGHOST:'aws-1-eu-west-1.pooler.supabase.com',PGPORT:'5432',PGUSER:'postgres.uskvezwftkkudvksmken',PGDATABASE:'postgres',
    PGPASSWORD:readPassword(envFile),PGSSLMODE:'verify-full',PGSSLROOTCERT:sourceCa,PGCONNECT_TIMEOUT:'10',PGCLIENTENCODING:'UTF8',
    PGOPTIONS:'-c default_transaction_read_only=on'};
  const session=new SqlSession(path.join(BIN,'psql.exe'),['-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],env);
  try {
    await session.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    for(const [kind,query] of Object.entries(SCHEMA_QUERIES)) {
      if(JSON.stringify(JSON.parse(await session.query(query)))!==JSON.stringify(metadata.source[kind]))
        throw new RecoveryError('schema_changed_before_supplement');
    }
    const source=JSON.parse(await session.query(supplementQuery));
    if(source.extension!=='pg_graphql'||source.extensionVersion!=='1.5.11')throw new RecoveryError('unexpected_bootstrap_dependency');
    const bytes=Buffer.from(JSON.stringify(source));
    fs.writeFileSync(path.join(directory,'bootstrap-supplement-v2.enc'),encryptBytes(bytes,key),{mode:0o600,flag:'wx'});bytes.fill(0);
    return {result:'SCHEMA_SUPPLEMENT_CAPTURED',privateProductionRowsExported:false,objectCount:1};
  } finally {key.fill(0);await session.close().catch(()=>{});}
}
async function waitForDatabase(name) {
  for(let i=0;i<30;i++) {
    if(spawnSync('docker',['exec',name,'pg_isready','-h','/tmp','-U','postgres'],{stdio:'ignore'}).status===0)return;
    await new Promise(r=>setTimeout(r,1000));
  }
  throw new RecoveryError('isolated_database_not_ready');
}
export function syntheticRoleSql() {
  return `BEGIN;
    DO $proof$ BEGIN
      SET LOCAL ROLE anon;
      BEGIN PERFORM count(*) FROM public.products;
        RAISE EXCEPTION 'recovery_direct_read_unexpectedly_allowed';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      BEGIN INSERT INTO public.products(product_name) VALUES('recovery-denied-write');
        RAISE EXCEPTION 'recovery_write_unexpectedly_allowed';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      RESET ROLE;
      SET LOCAL ROLE authenticated;
      BEGIN PERFORM count(*) FROM public.products;
        RAISE EXCEPTION 'recovery_direct_read_unexpectedly_allowed';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      RESET ROLE;
    END $proof$;
    SELECT jsonb_build_object('untrustedDirectReadsAndWritesDenied',true);
    SET LOCAL ROLE authenticated;
    SELECT jsonb_build_object('noPrivateRows',count(*)=0) FROM public.user_preferences;
    RESET ROLE;
    SET LOCAL ROLE service_role;
    SELECT jsonb_build_object('serviceCatalogRead',count(*)>0) FROM public.products;
    RESET ROLE;
    ROLLBACK;`;
}
export function validateCatalogReceipts(receipts,source,archiveHash,scopeProfile='catalog-v1') {
  if(!receipts.length)throw new RecoveryError('catalog_proof_missing');
  const tables=validateScopeMetadata(source,scopeProfile);
  const digest=/^[a-f0-9]{64}$/;
  for(const receipt of receipts) {
    if(receipt.schemaVersion!==(scopeProfile==='catalog-v1'?1:2)||(receipt.scopeProfile??'catalog-v1')!==scopeProfile||
      (scopeProfile==='observations-v1'&&receipt.observationDisposition!=='empty-in-export-snapshot')||
      receipt.environment!=='production'||receipt.method!=='backup-restore'||
      receipt.result!=='PASS'||receipt.scope!=='catalog-data'||!Number.isFinite(Date.parse(receipt.restoredAt))||
      receipt.backupSha256!==archiveHash||receipt.restoredBackupSha256!==archiveHash||!digest.test(archiveHash)||
      !['rowCounts','identityReferences','representativeValues','archiveBytes','tableShape'].every(k=>receipt.checks?.[k]===true)||
      receipt.unvalidatedStructuralConstraints!==0||receipt.sourceSchemaFingerprint!==hash(JSON.stringify(source.columns))||
      receipt.restoredSchemaFingerprint!==receipt.sourceSchemaFingerprint||
      !['tableDefinitions','internalConstraints','allRowValueHashes'].every(k=>receipt.coverage?.[k]===true)||
      !['authRows','authReferences','rls','triggers','rpcExecution','storageObjects'].every(k=>receipt.coverage?.[k]===false)||
      receipt.storageDisposition!=='not-affected'||JSON.stringify(receipt.coverage?.tables)!==JSON.stringify(tables)||
      !Array.isArray(receipt.tables)||receipt.tables.length!==tables.length||
      !tables.every((name,i)=>receipt.tables[i]?.name===name&&receipt.tables[i].rows===source.fingerprints[name]?.count&&
        receipt.tables[i].rowSha256===source.fingerprints[name]?.rowSha256&&digest.test(receipt.tables[i].rowSha256)))
      throw new RecoveryError('catalog_proof_incomplete_or_inconsistent');
  }
  if(receipts.some(r=>r.restoredAt!==receipts[0].restoredAt||r.restoreDatabase!==receipts[0].restoreDatabase))
    throw new RecoveryError('catalog_receipts_disagree');
  return receipts[0];
}
export async function schemaCatalogRecovery({envFile,sourceCa,catalogDirectory,manifestSha256,execute=false,schemaDirectory=null,captureOnly=false,
  onVerifiedRestore=null,writeReceipt=true,scopeProfile='catalog-v1',cloneLifetimeSeconds=300,combinedCapture=null}) {
  const tables=scopeTables(scopeProfile);
  if(!captureOnly&&!/^[a-f0-9]{64}$/.test(manifestSha256||''))throw new RecoveryError('migration_manifest_digest_required');
  const catalog=path.resolve(catalogDirectory||'');
  if(!catalog.startsWith(path.join(ROOT,'backups')+path.sep))throw new RecoveryError('catalog_archive_not_private');
  if(fs.realpathSync(catalog)!==catalog)throw new RecoveryError('catalog_archive_redirected');
  let combined=null;
  if(combinedCapture) {
    if(scopeProfile!=='observations-public-cohort-v1'||!schemaDirectory||path.resolve(schemaDirectory)!==catalog)
      throw new RecoveryError('combined_capture_scope_mismatch');
    const {loadCombinedPublicRecovery}=await import('./combined-public-recovery.mjs');
    combined=loadCombinedPublicRecovery(catalog,{expectedBinding:combinedCapture.binding,requireRestored:false});
  } else if(scopeProfile==='observations-public-cohort-v1')throw new RecoveryError('combined_capture_required');
  const old=combined?.sourceMetadata??JSON.parse(fs.readFileSync(path.join(catalog,'source-metadata.json'),'utf8'));
  const archive=combined?.catalogArchive??fs.readFileSync(path.join(catalog,'catalog.dump'));
  // Prefer current producer output; legacy-only directories remain supported.
  // Every present receipt must pass: never select around failed or weaker proof.
  const receipts=['receipt.json','verification-v2.json'].filter(f=>fs.existsSync(path.join(catalog,f)))
    .map(f=>JSON.parse(fs.readFileSync(path.join(catalog,f),'utf8')));
  if(!combined)validateCatalogReceipts(receipts,old,hash(archive),scopeProfile);
  else validateScopeMetadata(old,scopeProfile);
  if(!execute)return {result:'PREPARED',scope:'schema-and-catalog',scopeProfile,privateProductionRowsExported:false};
  const directory=schemaDirectory?path.resolve(schemaDirectory):path.join(ROOT,'backups','schema_catalog_'+Date.now()+'_'+randomBytes(3).toString('hex'));
  if(schemaDirectory&&(!directory.startsWith(path.join(ROOT,'backups','schema_catalog_'))||fs.realpathSync(directory)!==directory))
    throw new RecoveryError('schema_archive_not_private');
  if(!schemaDirectory)privateDirectory(directory);
  let source={},roles,memberships,plainHash,sealed;const key=schemaDirectory?
    dpapi('unprotect',fs.readFileSync(path.join(directory,'schema.key.dpapi'))):randomBytes(32);
  if(schemaDirectory) {
    const metadata=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,'metadata.enc')),key));
    ({source,roles,memberships,plainHash}=metadata);
    if((metadata.scopeProfile??'catalog-v1')!==scopeProfile)throw new RecoveryError('schema_catalog_scope_mismatch');
    if(metadata.catalogArchiveSha256!==hash(archive))throw new RecoveryError('schema_catalog_pair_mismatch');
    sealed=fs.readFileSync(path.join(directory,'schema.dump.enc'));
  } else {
  const baseEnv={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP,
    PGHOST:'aws-1-eu-west-1.pooler.supabase.com',PGPORT:'5432',PGUSER:'postgres.uskvezwftkkudvksmken',PGDATABASE:'postgres',
    PGPASSWORD:readPassword(envFile),PGSSLMODE:'verify-full',PGSSLROOTCERT:sourceCa,PGCONNECT_TIMEOUT:'10',PGCLIENTENCODING:'UTF8',
    PGOPTIONS:'-c default_transaction_read_only=on'};
  const session=new SqlSession(path.join(BIN,'psql.exe'),['-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],baseEnv);
  try {
    await session.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET TIME ZONE 'UTC'");
    const snapshot=await session.query('SELECT pg_export_snapshot()');
    for(const [kind,query] of Object.entries(SCHEMA_QUERIES)) {
      try {source[kind]=JSON.parse(await session.query(query));}
      catch(error) {throw new RecoveryError('source_'+kind+'_'+(error instanceof RecoveryError?error.code:'metadata_failed'));}
    }
    roles=JSON.parse(await session.query(rolesQuery));
    memberships=JSON.parse(await session.query(membershipsQuery));
    // Reconfirm the catalog used for this combined recovery has not drifted.
    for(const table of tables)if(JSON.stringify(JSON.parse(await session.query(fingerprintQuery(table,scopeProfile))))!==JSON.stringify(old.fingerprints[table]))
      throw new RecoveryError('catalog_changed_since_backup');
    const args=['--format=custom','--schema-only','--no-large-objects',`--snapshot=${snapshot}`];
    assertSchemaOnlyArgs(args);
    const plain=processOpaque(path.join(BIN,'pg_dump.exe'),args,null,baseEnv,'export');
    plainHash=hash(plain);sealed=encryptBytes(plain,key);plain.fill(0);
    fs.writeFileSync(path.join(directory,'schema.dump.enc'),sealed,{mode:0o600});
    fs.writeFileSync(path.join(directory,'schema.key.dpapi'),dpapi('protect',key),{mode:0o600});
    fs.writeFileSync(path.join(directory,'metadata.enc'),encryptBytes(Buffer.from(JSON.stringify({source,roles,memberships,plainHash,
      scopeProfile,catalogArchiveSha256:hash(archive),capturedAt:new Date().toISOString()})),key),{mode:0o600});
  } finally {await session.close().catch(()=>{});}
  await captureSupplement({envFile,sourceCa,schemaDirectory:directory});
  }
  if(captureOnly) {key.fill(0);archive.fill(0);return {result:'CAPTURED_NOT_RESTORED',scope:'schema-and-catalog',
    privateProductionRowsExported:false,encryptedBackupSha256:hash(sealed),archiveDirectory:path.relative(ROOT,directory)};}
  const name='tryvit_recovery_probe_'+randomBytes(6).toString('hex');let created=false;let receipt;let plain,unwrapped,integration;
  try {
    docker(containmentArgs(name,{database:true,bootstrapUser:OPERATOR,locale:'en_US.UTF-8',lifetimeSeconds:cloneLifetimeSeconds}));created=true;await waitForDatabase(name);
    assertContained(JSON.parse(docker(['inspect',name]))[0]);
    // Roles are structural metadata only, never password hashes or rolconfig.
    if(roles.some(r=>r.name===OPERATOR))throw new RecoveryError('recovery_operator_name_collision');
    for(const r of roles) localSql(name,`CREATE ROLE ${quote(r.name)} ${r.super?'SUPERUSER':'NOSUPERUSER'} ${r.inherit?'INHERIT':'NOINHERIT'} ${r.createRole?'CREATEROLE':'NOCREATEROLE'} ${r.createDb?'CREATEDB':'NOCREATEDB'} ${r.login?'LOGIN':'NOLOGIN'} ${r.replication?'REPLICATION':'NOREPLICATION'} ${r.bypassRls?'BYPASSRLS':'NOBYPASSRLS'};`,OPERATOR,
      'roles_'+(['postgres','supabase_admin','anon','authenticated','service_role','authenticator','supabase_auth_admin','supabase_storage_admin'].includes(r.name)?r.name:'other'));
    localSql(name,memberships.map(m=>`GRANT ${quote(m.role)} TO ${quote(m.member)} WITH ADMIN ${m.admin}, INHERIT ${m.inherit}, SET ${m.set};`).join('\n'),OPERATOR,'memberships');
    unwrapped=dpapi('unprotect',fs.readFileSync(path.join(directory,'schema.key.dpapi')));
    plain=decryptBytes(fs.readFileSync(path.join(directory,'schema.dump.enc')),unwrapped);
    if(hash(plain)!==plainHash)throw new RecoveryError('schema_archive_decryption_mismatch');
    // Authenticate the entire archive before any source SQL is executed.
    const bootstrapBytes=fs.readFileSync(path.join(directory,'bootstrap-supplement-v2.enc'));
    const bootstrap=JSON.parse(decryptBytes(bootstrapBytes,unwrapped));
    const toc=splitBootstrapToc(processOpaque(path.join(BIN,'pg_restore.exe'),['--list'],plain,undefined,'toc').toString());
    processOpaque('docker',['exec','-i',name,'dd','of=/tmp/prerequisites.list','status=none'],Buffer.from(toc.early),undefined,'toc_copy');
    processOpaque('docker',['exec','-i',name,'dd','of=/tmp/remaining.list','status=none'],Buffer.from(toc.remaining),undefined,'toc_copy');
    processOpaque('docker',['exec','-i',name,'pg_restore','-h','/tmp','-U',OPERATOR,'-d','postgres','--exit-on-error','--section=pre-data','--use-list=/tmp/prerequisites.list'],plain,undefined,'prerequisites');
    localSql(name,bootstrap.definition+`;\nALTER FUNCTION graphql_public.graphql(${bootstrap.arguments}) OWNER TO ${quote(bootstrap.owner)};
      ALTER EXTENSION pg_graphql ADD FUNCTION graphql_public.graphql(${bootstrap.arguments});`,OPERATOR,'bootstrap');
    processOpaque('docker',['exec','-i',name,'pg_restore','-h','/tmp','-U',OPERATOR,'-d','postgres','--exit-on-error','--section=pre-data','--use-list=/tmp/remaining.list'],plain,undefined,'predata');
    processOpaque('docker',['exec','-i',name,'pg_restore','-h','/tmp','-U',OPERATOR,'-d','postgres','--exit-on-error','--data-only','--no-owner','--no-privileges'],archive,undefined,'catalog');
    processOpaque('docker',['exec','-i',name,'pg_restore','-h','/tmp','-U',OPERATOR,'-d','postgres','--exit-on-error','--section=post-data'],plain,undefined,'postdata');
    // Supabase bootstrap-owned schemas are attached to the extension. pg_dump
    // omits their ACL replay; restore the actual captured owners/grants exactly.
    for(const schema of bootstrap.schemas) {
      if(!['graphql','graphql_public'].includes(schema.name))throw new RecoveryError('unexpected_supplement_schema');
      localSql(name,`ALTER SCHEMA ${quote(schema.name)} OWNER TO ${quote(schema.owner)};`,OPERATOR,'bootstrap_owner');
      const grants=localSql(name,`SELECT format('GRANT %s ON SCHEMA %I TO %s%s;',privilege_type,${literal(schema.name)},
        CASE WHEN grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantee)) END,
        CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
        FROM aclexplode(${literal(schema.acl)}::aclitem[]) ORDER BY grantor,grantee,privilege_type`,OPERATOR,'bootstrap_acl_read');
      localSql(name,`BEGIN; SET LOCAL ROLE ${quote(schema.owner)};\n${grants}\nCOMMIT;`,OPERATOR,'bootstrap_acl_apply');
    }
    const restoredHash=hash(plain);plain.fill(0);unwrapped.fill(0);
    const restored={};for(const [kind,query]of Object.entries(SCHEMA_QUERIES))restored[kind]=JSON.parse(localSql(name,query));
    if(writeReceipt)fs.writeFileSync(path.join(directory,'restored-metadata.enc'),encryptBytes(Buffer.from(JSON.stringify(restored)),key),{mode:0o600});
    source.schema=canonicalStructure(source.schema);restored.schema=canonicalStructure(restored.schema);
    source.grants=canonicalGrants(name,source.grants);restored.grants=canonicalGrants(name,restored.grants);
    const rows={};for(const table of tables)rows[table]=JSON.parse(localSql(name,fingerprintQuery(table,scopeProfile)));
    const checks={};for(const kind of Object.keys(SCHEMA_QUERIES))checks[kind]=JSON.stringify(source[kind])===JSON.stringify(restored[kind]);
    checks.roleAttributes=JSON.stringify(roles)===JSON.stringify(JSON.parse(localSql(name,rolesQuery)));
    checks.roleMemberships=JSON.stringify(memberships)===JSON.stringify(JSON.parse(localSql(name,membershipsQuery)));
    const restoredBootstrap=JSON.parse(localSql(name,supplementQuery));
    const withoutSchemaAcl=value=>({...value,schemas:value.schemas.map(({name,owner})=>({name,owner}))});
    checks.extensionBootstrap=JSON.stringify(withoutSchemaAcl(bootstrap))===JSON.stringify(withoutSchemaAcl(restoredBootstrap));
    const equal=JSON.stringify(rows)===JSON.stringify(old.fingerprints);
    checks.rowCounts=tables.every(t=>rows[t].count===old.fingerprints[t].count);checks.identityReferences=equal;checks.representativeValues=equal;
    const behavior=localSql(name,syntheticRoleSql()).trim().split(/\r?\n/).filter(Boolean).map(v=>JSON.parse(v));
    checks.syntheticRoles=behavior.length===3&&behavior.every(v=>Object.values(v).every(x=>x===true));
    receipt={schemaVersion:scopeProfile==='catalog-v1'?1:2,...(scopeProfile==='catalog-v1'?{}:{scopeProfile,catalogTables:tables}),
      ...(scopeProfile==='observations-v1'?{observationDisposition:'empty-in-export-snapshot'}:{}),
      ...(combined?{binding:combined.binding,observationDisposition:old.observationDisposition,publicAllowlistSha256:old.publicAllowlistSha256}:{}),
      environment:combined?.binding.environment??'production',scope:'schema-and-catalog',method:'backup-restore',migrationManifestSha256:manifestSha256,
      backupSha256:plainHash,restoredBackupSha256:restoredHash,encryptedBackupSha256:hash(sealed),
      bootstrapSupplementSha256:hash(bootstrapBytes),
      catalogSha256:hash(JSON.stringify(old.fingerprints)),restoredCatalogSha256:hash(JSON.stringify(rows)),
      restoredAt:new Date().toISOString(),result:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,
      exclusions:['privateUserRows','historyRows','managedAuthServices','storageObjects'],storageDisposition:'not-affected',
      privateProductionRowsExported:false,containerImage:IMAGE,databaseLocale:'en_US.UTF-8',catalogTableCount:tables.length,
      catalogRowCount:tables.reduce((sum,t)=>sum+rows[t].count,0),
      limitations:['No private-user/history row recovery claim','No role-password or platform-role-setting recovery claim',
        'No managed Auth service, cloud configuration or storage-object recovery claim'],
      sourceFingerprints:Object.fromEntries(Object.entries(source).map(([k,v])=>[k,hash(JSON.stringify(v))])),
      restoredFingerprints:Object.fromEntries(Object.entries(restored).map(([k,v])=>[k,hash(JSON.stringify(v))]))};
    if(onVerifiedRestore) {
      if(receipt.result!=='PASS')throw new RecoveryError('integration_requires_verified_restore');
      integration=await onVerifiedRestore({
        originalPostgresAttributes:roles.find(r=>r.name==='postgres'),
        sqlAsPostgres:(sql,stage='integration')=>localSql(name,sql,'postgres',stage),
        lintManagedSchemas:()=>JSON.parse(localSql(name,String.raw`BEGIN;
          CREATE EXTENSION IF NOT EXISTS plpgsql_check WITH SCHEMA public;
          SET LOCAL ROLE postgres;
          -- Exact selection/check rules used by release-pinned CLI v2.111.0:
          -- apps/cli/src/legacy/commands/db/lint/lint.lint-sql.ts (same as v2.75.0).
          WITH schemas AS (
            SELECT pn.nspname FROM pg_namespace pn LEFT JOIN pg_depend pd ON pd.objid=pn.oid
            WHERE pd.deptype IS NULL AND NOT pn.nspname LIKE ANY(ARRAY[
              'information\_schema','pg\_%','\_analytics','\_realtime','\_supavisor','pgbouncer','pgmq','pgsodium','pgtle',
              'supabase\_migrations','vault']) AND pn.nspowner::regrole::text<>'supabase_admin'
          ), functions AS (
            SELECT p.oid,n.nspname,p.proname FROM pg_catalog.pg_namespace n
            JOIN pg_catalog.pg_proc p ON p.pronamespace=n.oid
            JOIN pg_catalog.pg_language l ON p.prolang=l.oid
            WHERE l.lanname='plpgsql' AND p.prorettype<>2279 AND n.nspname IN (SELECT nspname FROM schemas)
          ), issues AS (
            SELECT f.nspname||'.'||f.proname AS routine,i AS issue FROM functions f
            CROSS JOIN LATERAL public.plpgsql_check_function(f.oid,format:='json') report
            CROSS JOIN LATERAL jsonb_array_elements(report::jsonb->'issues') i
          ) SELECT jsonb_build_object('method','Supabase CLI v2.111.0 equivalent whole-user-schema lint',
            'schemas',(SELECT jsonb_agg(nspname ORDER BY nspname) FROM schemas),
            'checkedFunctions',(SELECT count(*) FROM functions),
            'errors',(SELECT COALESCE(jsonb_agg(jsonb_build_object('function',routine,'sqlState',issue->>'sqlState',
              'line',issue->'statement'->>'lineNumber')) FILTER(WHERE issue->>'level' LIKE 'error%'),'[]'::jsonb) FROM issues),
            'warningCount',(SELECT count(*) FROM issues WHERE issue->>'level' LIKE 'warning%'));
          ROLLBACK;`,OPERATOR,'whole_database_lint')),
        installPgTap:()=>localSql(name,'CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;'+
          "SELECT extversion FROM pg_extension WHERE extname='pgtap';",OPERATOR,'pgtap_install'),
        installOrphanFixture:()=>localSql(name,`CREATE SCHEMA recovery_fixture;
          REVOKE ALL ON SCHEMA recovery_fixture FROM PUBLIC; GRANT USAGE ON SCHEMA recovery_fixture TO postgres;
          CREATE FUNCTION recovery_fixture.insert_fixed_orphan() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
          SET search_path='' SET session_replication_role='replica' AS $fixture$
          BEGIN
            IF NOT EXISTS(SELECT 1 FROM public.user_product_lists
              WHERE id='dddddddd-3333-4333-8333-333333333333' AND user_id='dddddddd-1111-4111-8111-111111111111')
              OR EXISTS(SELECT 1 FROM public.products WHERE product_id=990999999) THEN
              RAISE EXCEPTION 'Synthetic orphan fixture precondition failed';
            END IF;
            INSERT INTO public.user_product_list_items(list_id,product_id,position,notes)
              VALUES('dddddddd-3333-4333-8333-333333333333',990999999,30,'Orphan fixture note');
          END $fixture$;
          REVOKE ALL ON FUNCTION recovery_fixture.insert_fixed_orphan() FROM PUBLIC;
          GRANT EXECUTE ON FUNCTION recovery_fixture.insert_fixed_orphan() TO postgres;
          CREATE FUNCTION recovery_fixture.insert_fixed_home_orphans() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
          SET search_path='' SET session_replication_role='replica' AS $fixture$
          BEGIN
            IF NOT EXISTS(SELECT 1 FROM public.user_product_lists WHERE user_id='ffffffff-2222-4222-8222-222222222222' AND list_type='favorites')
              OR EXISTS(SELECT 1 FROM public.products WHERE product_id=9000001) THEN
              RAISE EXCEPTION 'Synthetic Home orphan fixture precondition failed';
            END IF;
            INSERT INTO public.user_product_views(user_id,product_id,viewed_at)
              VALUES('ffffffff-2222-4222-8222-222222222222',9000001,now());
            INSERT INTO public.user_product_list_items(list_id,product_id,position)
              SELECT id,9000001,-1 FROM public.user_product_lists WHERE user_id='ffffffff-2222-4222-8222-222222222222' AND list_type='favorites';
          END $fixture$;
          REVOKE ALL ON FUNCTION recovery_fixture.insert_fixed_home_orphans() FROM PUBLIC;
          GRANT EXECUTE ON FUNCTION recovery_fixture.insert_fixed_home_orphans() TO postgres;`,OPERATOR,'orphan_fixture_install'),
        restoreDatabaseAuthority:authority=>{
          if(authority.project!=='uskvezwftkkudvksmken'||authority.database!=='postgres'||authority.owner!=='postgres'||
            typeof authority.acl!=='string'||!Number.isFinite(Date.parse(authority.checkedAt)))
            throw new RecoveryError('database_authority_not_verified');
          localSql(name,'ALTER DATABASE postgres OWNER TO postgres; REVOKE ALL ON DATABASE postgres FROM PUBLIC;',OPERATOR,'database_owner');
          const grants=localSql(name,`SELECT format('GRANT %s ON DATABASE postgres TO %s%s;',privilege_type,
            CASE WHEN grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grantee)) END,
            CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
            FROM aclexplode(${literal(authority.acl)}::aclitem[]) ORDER BY grantor,grantee,privilege_type`,OPERATOR,'database_acl_read');
          localSql(name,`BEGIN;SET LOCAL ROLE postgres;\n${grants}\nCOMMIT;`,OPERATOR,'database_acl_apply');
          return JSON.parse(localSql(name,`SELECT jsonb_build_object('owner',pg_get_userbyid(datdba)='postgres','acl',
            (SELECT jsonb_agg(to_jsonb(a) ORDER BY grantor,grantee,privilege_type) FROM aclexplode(datacl) a)=
            (SELECT jsonb_agg(to_jsonb(a) ORDER BY grantor,grantee,privilege_type) FROM aclexplode(${literal(authority.acl)}::aclitem[]) a))
            FROM pg_database WHERE datname='postgres'`,OPERATOR,'database_authority_verify'));
        },
      });
    }
  } finally {
    key.fill(0);archive.fill(0);plain?.fill(0);unwrapped?.fill(0);
    if(created){assertContained(JSON.parse(docker(['inspect',name]))[0]);docker(['rm','--force',name]);}
  }
  if(writeReceipt) {
    const receiptText=JSON.stringify(receipt,null,2)+'\n';
    fs.writeFileSync(path.join(directory,'receipt-'+Date.now()+'.json'),receiptText,{mode:0o600,flag:'wx'});
    fs.writeFileSync(path.join(directory,'receipt.json'),receiptText,{mode:0o600});
  }
  return {result:integration?.result??receipt.result,scope:receipt.scope,checks:receipt.checks,
    receipt:writeReceipt?path.relative(ROOT,path.join(directory,'receipt.json')):null,integration};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  const operation=args.includes('--capture-supplement')?
    (args.includes('--execute')?captureSupplement({envFile:value('--source-env-file'),sourceCa:value('--source-ca'),schemaDirectory:value('--schema-directory')}):
      Promise.resolve({result:'PREPARED',productionExported:false})):
    schemaCatalogRecovery({envFile:value('--source-env-file'),sourceCa:value('--source-ca'),catalogDirectory:value('--catalog-directory'),schemaDirectory:value('--schema-directory'),manifestSha256:value('--manifest-sha256'),scopeProfile:value('--scope-profile')??'catalog-v1',execute:args.includes('--execute'),captureOnly:args.includes('--capture-only')});
  operation
    .then(value=>{console.log(JSON.stringify(value));if(value.result==='FAIL')process.exitCode=1;})
    .catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'opaque_schema_restore_failed'}));process.exitCode=1;});
}
