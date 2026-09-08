/** Catalog DATA recovery only. No auth rows, remote writes, or shared-DB restore.
 * Native pg_dump/pg_restore are used; records never pass through console output.
 * Schema/RPC fingerprints are evidence, not proof of managed-service recovery.
 */
import {spawn, spawnSync} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {CATALOG_TABLES,CONSUMER_TABLES} from '../ci/recovery-scopes.mjs';

export const TABLES = CATALOG_TABLES;
export const OBSERVATION_TABLES = Object.freeze(['ingestion_batches','product_source_records',
  'product_source_observations','product_source_assertions']);
export const SCOPE_PROFILES = Object.freeze({
  'catalog-v1': TABLES,
  'consumer-v1': CONSUMER_TABLES,
  'observations-v1': Object.freeze([...CONSUMER_TABLES,...OBSERVATION_TABLES]),
});
export function scopeTables(scopeProfile='catalog-v1') {
  if(!Object.hasOwn(SCOPE_PROFILES,scopeProfile)) throw new RecoveryError('unknown_catalog_scope_profile');
  return SCOPE_PROFILES[scopeProfile];
}
export function validateScopeMetadata(source,scopeProfile='catalog-v1') {
  const tables=scopeTables(scopeProfile);
  if((source.scopeProfile??'catalog-v1')!==scopeProfile ||
    JSON.stringify(Object.keys(source.fingerprints??{}).sort())!==JSON.stringify([...tables].sort()))
    throw new RecoveryError('catalog_source_scope_mismatch');
  if(scopeProfile==='observations-v1' && (source.observationDisposition!=='empty-in-export-snapshot' ||
    OBSERVATION_TABLES.some(t=>source.fingerprints[t].count!==0 ||
      source.fingerprints[t].rowSha256!==createHash('sha256').update('').digest('hex'))))
    throw new RecoveryError('populated_observation_capture_not_approved');
  return tables;
}
export async function assertEmptyObservations(session) {
  for(const table of OBSERVATION_TABLES) {
    const count=String(await session.query(`SELECT count(*) FROM public.${identifier(table)}`)).trim();
    if(count!=='0')throw new RecoveryError('populated_observation_capture_not_approved');
  }
}
export function privateIdentityQuery(column) {
  const allowedCreator=column.table==='scoring_model_versions'&&column.name==='created_by';
  return `SELECT count(*) FROM public.${identifier(column.table)} WHERE ${identifier(column.name)} IS NOT NULL`+
    (allowedCreator?` AND ${identifier(column.name)} NOT IN ('postgres','system','migration-608')`:'');
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const PROJECT = 'uskvezwftkkudvksmken';
const CONTAINER = 'supabase_db_tryvit-evidence-first';
const BIN = 'C:/Program Files/PostgreSQL/18/bin';

export class RecoveryError extends Error {
  constructor(code) { super(code); this.code=code; }
}
export function identifier(value) {
  if(!/^[a-z][a-z0-9_]*$/.test(value)) throw new RecoveryError('invalid_identifier');
  return `"${value}"`;
}
export function externalCatalogColumn(constraint) {
  if (constraint.table === 'products' && constraint.reference_schema === 'auth' &&
      constraint.reference_table === 'users' && constraint.definition.includes('product_name_en_reviewed_by'))
    return 'product_name_en_reviewed_by';
  if (constraint.table === 'product_field_provenance' && constraint.reference_schema === 'public' &&
      constraint.reference_table === 'product_source_observations' &&
      constraint.name === 'product_field_provenance_observation_id_fkey' &&
      constraint.definition === 'FOREIGN KEY (observation_id) REFERENCES product_source_observations(id)')
    return 'observation_id';
  throw new RecoveryError('unreviewed_external_catalog_reference');
}
export function validateRestoreName(value) {
  if(!/^tryvit_catalog_restore_[0-9]{13}_[a-f0-9]{6}$/.test(value)) throw new RecoveryError('unsafe_restore_database');
  return value;
}
export function readPassword(envFile, environment=process.env) {
  if(environment.SUPABASE_DB_PASSWORD) return environment.SUPABASE_DB_PASSWORD;
  if(!envFile) throw new RecoveryError('source_credential_unavailable');
  const line=fs.readFileSync(envFile,'utf8').split(/\r?\n/).find(v=>/^\s*SUPABASE_DB_PASSWORD\s*=/.test(v));
  if(!line) throw new RecoveryError('source_credential_unavailable');
  let value=line.slice(line.indexOf('=')+1).trim();
  if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
  if(!value||/^(changeme|your.*password|<.*>)$/i.test(value)) throw new RecoveryError('source_credential_unavailable');
  return value;
}
const hash = value=>createHash('sha256').update(value).digest('hex');
export function command(executable,args,options={}) {
  const result=spawnSync(executable,args,{encoding:'utf8',maxBuffer:16*1024*1024,...options});
  if(result.status!==0) {
    const error=result.stderr||'';
    let code='native_command_failed';
    if(/password authentication failed/i.test(error)) code='database_authentication_failed';
    else if(/certificate|SSL error/i.test(error)) code='database_tls_failed';
    else if(/could not translate host name/i.test(error)) code='database_dns_failed';
    throw new RecoveryError(code); // Never include argv/env/stdout/stderr in errors.
  }
  return result.stdout;
}

export class SqlSession {
  constructor(executable,args,env) {
    this.child=spawn(executable,args,{env,stdio:['pipe','pipe','pipe']});
    this.pending=null; this.error='';
    readline.createInterface({input:this.child.stdout}).on('line',line=>{
      if(!this.pending) return;
      if(line===this.pending.marker) {const p=this.pending;this.pending=null;clearTimeout(p.timer);p.resolve(p.lines.join('\n'));}
      else this.pending.lines.push(line);
    });
    this.child.stderr.on('data',buffer=>{this.error=(this.error+buffer.toString()).slice(-65536);});
    this.child.on('error',()=>this.fail('sql_session_start_failed'));
    this.child.on('exit',()=>this.fail(/certificate|SSL error/i.test(this.error)?'database_tls_failed':
      /password authentication failed/i.test(this.error)?'database_authentication_failed':
      `sql_session_failed_${this.error.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5})\b/)?.[1]||'unknown'}`));
  }
  fail(code) {if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(new RecoveryError(code));this.pending=null;}}
  query(sql) {
    if(this.pending) throw new RecoveryError('concurrent_snapshot_query');
    return new Promise((resolve,reject)=>{
      const marker='recovery_'+randomBytes(12).toString('hex');
      this.pending={marker,resolve,reject,lines:[],timer:setTimeout(()=>{this.fail('sql_timeout');this.child.kill();},120000)};
      this.child.stdin.write(sql+';\n\\echo '+marker+'\n');
    });
  }
  async close() {if(this.child.exitCode===null){await this.query('ROLLBACK');this.child.stdin.end('\\q\n');}}
}
export function fingerprintQuery(table,scopeProfile='catalog-v1') {
  if(!scopeTables(scopeProfile).includes(table)) throw new RecoveryError('table_outside_catalog_scope');
  return `SELECT jsonb_build_object('count',count(*),'rowSha256',encode(sha256(convert_to(COALESCE(
    string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text COLLATE "C"),''),'UTF8')),'hex'))
    FROM public.${identifier(table)} t`;
}
export function columnMetadataQuery(scopeProfile='catalog-v1') {
  const names=scopeTables(scopeProfile).map(t=>`'${t}'`).join(',');
  return `SELECT jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,
    'type',udt_name,'nullable',is_nullable,'default',column_default,'generated',generation_expression)
    ORDER BY table_name,ordinal_position) FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN (${names})`;
}
export function dumpArgs(file,snapshot,scopeProfile='catalog-v1') {
  return ['--format=custom','--no-owner','--no-privileges','--no-large-objects',`--file=${file}`,
    `--snapshot=${snapshot}`,...scopeTables(scopeProfile).map(t=>`--table=public.${t}`)];
}
export function filterToc(toc,externalConstraintNames) {
  return toc.split(/\r?\n/).filter(line=>{
    if(!line.trim()||line.startsWith(';')) return true;
    if(externalConstraintNames.some(name=>line.split(/\s+/).includes(name))) return false;
    // Data-store structure only; do not execute source triggers/policies or
    // pretend to restore API programs and Auth dependencies.
    return /\b(?:TABLE DATA|SEQUENCE SET|SEQUENCE OWNED BY|SEQUENCE|TABLE|DEFAULT|FK CONSTRAINT|CONSTRAINT) public\b/.test(line);
  }).join('\n')+'\n';
}
export function privateDirectory(directory) {
  const allowed=path.join(ROOT,'backups');
  const relative=path.relative(allowed,directory);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!relative) throw new RecoveryError('unsafe_backup_directory');
  if(fs.realpathSync(allowed)!==path.resolve(allowed)) throw new RecoveryError('backup_root_is_redirected');
  fs.mkdirSync(directory,{recursive:false,mode:0o700});
  if(process.platform==='win32') {
    const who=command('whoami',['/user','/fo','csv','/nh']);
    const sid=who.match(/S-1-[0-9-]+/)[0];
    command('icacls',[directory,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`,
      '*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F']);
  }
}
export async function sourceMetadata(session,scopeProfile='catalog-v1') {
  const tables=scopeTables(scopeProfile);
  const names=tables.map(t=>`'${t}'`).join(',');
  const columns=JSON.parse(await session.query(columnMetadataQuery(scopeProfile)));
  if(JSON.stringify([...new Set(columns.map(c=>c.table))].sort())!==JSON.stringify([...tables].sort()))
    throw new RecoveryError('catalog_table_missing');
  // Same exported repeatable-read snapshot, before any row dump. No stored
  // payload is inspected or exported until a populated policy is approved.
  if(scopeProfile==='observations-v1')await assertEmptyObservations(session);
  const constraints=JSON.parse(await session.query(`SELECT COALESCE(jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,
    'kind',c.contype,'definition',pg_get_constraintdef(c.oid),'reference_schema',fn.nspname,'reference_table',fr.relname)
    ORDER BY r.relname,c.conname),'[]'::jsonb) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace LEFT JOIN pg_class fr ON fr.oid=c.confrelid
    LEFT JOIN pg_namespace fn ON fn.oid=fr.relnamespace WHERE n.nspname='public' AND r.relname IN (${names})`));
  // Inspect counts only, never identities, inside the same snapshot as pg_dump.
  for(const column of columns.filter(c=>/(?:reviewed|verified|created|updated|approved|submitted|uploaded)_by$|(?:^|_)(?:user|owner|actor|customer|patient)_id$|email|password|secret|token/i.test(c.name))) {
    const count=Number(await session.query(privateIdentityQuery(column)));
    if(count) throw new RecoveryError('catalog_contains_private_identity_or_secret');
  }
  if(Number(await session.query("SELECT count(*) FROM public.product_images WHERE source IS DISTINCT FROM 'off_api'")))
    throw new RecoveryError('non_off_image_rows_require_scope_review');
  if(Number(await session.query("SELECT count(*) FROM public.data_sources WHERE metadata IS NOT NULL AND metadata <> '{}'::jsonb")))
    throw new RecoveryError('source_metadata_requires_privacy_review');
  const external=constraints.filter(c=>c.kind==='f' && (c.reference_schema!=='public'||!tables.includes(c.reference_table)));
  for (const constraint of external) {
    const column = externalCatalogColumn(constraint);
    if (Number(await session.query(`SELECT count(*) FROM public.${identifier(constraint.table)} WHERE ${identifier(column)} IS NOT NULL`)))
      throw new RecoveryError('populated_external_catalog_reference_requires_scope_review');
  }
  const rpc=JSON.parse(await session.query(`SELECT COALESCE(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,
    'sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')) ORDER BY p.oid::regprocedure::text),'[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')
    AND p.proname IN ('api_search_products','api_product_profile','api_get_product_by_barcode','compute_score',
      'compute_unhealthiness_v33','assign_confidence','compute_data_confidence','compute_data_completeness',
      'field_to_group','compute_provenance_confidence')`));
  const view=await session.query("SELECT encode(sha256(convert_to(pg_get_viewdef('public.v_master'::regclass,true),'UTF8')),'hex')");
  return {...(scopeProfile==='catalog-v1'?{}:{scopeProfile}),
    ...(scopeProfile==='observations-v1'?{observationDisposition:'empty-in-export-snapshot'}:{}),
    columns,constraints,external,rpc,masterViewSha256:view};
}

export async function catalogRecovery({envFile,sourceCa=null,execute=false,manifestSha256=null,scopeProfile='catalog-v1'}={}) {
  const tables=scopeTables(scopeProfile);
  const password=readPassword(envFile);
  const bin=name=>path.join(BIN,name+'.exe');
  for(const name of ['psql','pg_dump','pg_restore']) if(!fs.existsSync(bin(name))) throw new RecoveryError('postgres_client_missing');
  const inspection=JSON.parse(command('docker',['inspect',CONTAINER]))[0];
  if(inspection.Config.Labels['com.supabase.cli.project']!=='tryvit-evidence-first' ||
    inspection.HostConfig.PortBindings['5432/tcp'].some(p=>p.HostIp!=='127.0.0.1'||p.HostPort!=='55102'))
    throw new RecoveryError('restore_container_not_owned_loopback');
  const restoreName=validateRestoreName(`tryvit_catalog_restore_${Date.now()}_${randomBytes(3).toString('hex')}`);
  const safeEnv={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,
    TEMP:process.env.TEMP,TMP:process.env.TMP,PGCONNECT_TIMEOUT:'10',PGCLIENTENCODING:'UTF8'};
  const sourceEnv={...safeEnv,PGHOST:'aws-1-eu-west-1.pooler.supabase.com',PGPORT:'5432',
    PGUSER:`postgres.${PROJECT}`,PGDATABASE:'postgres',PGPASSWORD:password,
    PGSSLMODE:'verify-full',PGSSLROOTCERT:sourceCa||'system',PGOPTIONS:'-c default_transaction_read_only=on'};
  if(!execute) return {result:'PREPARED',scope:'catalog-data',scopeProfile,tables,credentialAvailable:true,
    productionExported:false,restoreTarget:restoreName};
  fs.mkdirSync(path.join(ROOT,'backups'),{recursive:true,mode:0o700});
  const directory=path.join(ROOT,'backups',restoreName);
  privateDirectory(directory);
  const session=new SqlSession(bin('psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],sourceEnv);
  let source;
  const archive=path.join(directory,'catalog.dump');
  try {
    await session.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TIME ZONE 'UTC'");
    const snapshot=await session.query('SELECT pg_export_snapshot()');
    if(!/^[0-9A-Fa-f-]+$/.test(snapshot)) throw new RecoveryError('invalid_snapshot_identifier');
    source=await sourceMetadata(session,scopeProfile);
    source.fingerprints={};
    for(const table of tables) source.fingerprints[table]=JSON.parse(await session.query(fingerprintQuery(table,scopeProfile)));
    fs.writeFileSync(path.join(directory,'source-metadata.json'),JSON.stringify(source,null,2)+'\n',{mode:0o600});
    command(bin('pg_dump'),dumpArgs(archive,snapshot,scopeProfile),{env:sourceEnv});
  } finally {await session.close().catch(()=>{});}
  const archiveHash=hash(fs.readFileSync(archive));
  const toc=command(bin('pg_restore'),['--list',archive],{env:safeEnv});
  const restoreList=path.join(directory,'catalog-restore.list');
  fs.writeFileSync(restoreList,filterToc(toc,source.external.map(c=>c.name)),{mode:0o600});
  const existing=command('docker',['exec',CONTAINER,'psql','-U','postgres','-d','postgres','-X','-At','-c',
    `SELECT count(*) FROM pg_database WHERE datname='${restoreName}'`]);
  if(Number(existing)!==0) throw new RecoveryError('restore_database_already_exists');
  command('docker',['exec',CONTAINER,'psql','-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1','-c',
    `CREATE DATABASE ${identifier(restoreName)} TEMPLATE template0`]);
  const localPassword=inspection.Config.Env.find(v=>v.startsWith('POSTGRES_PASSWORD='))?.split('=').slice(1).join('=');
  if(!localPassword) throw new RecoveryError('local_database_credential_unavailable');
  const targetEnv={...safeEnv,PGHOST:'127.0.0.1',PGPORT:'55102',PGUSER:'postgres',PGDATABASE:restoreName,
    PGPASSWORD:localPassword,PGSSLMODE:'disable',PGOPTIONS:'-c timezone=UTC'};
  command(bin('pg_restore'),['--no-owner','--no-privileges','--exit-on-error','--single-transaction',
    `--use-list=${restoreList}`,'--dbname='+restoreName,archive],{env:targetEnv});
  const restored={};
  for(const table of tables) restored[table]=JSON.parse(command(bin('psql'),['-X','-qAt','-v','ON_ERROR_STOP=1',
    '-c',fingerprintQuery(table,scopeProfile)],{env:targetEnv}));
  const restoredColumns=JSON.parse(command(bin('psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',columnMetadataQuery(scopeProfile)],{env:targetEnv}));
  const schemaEqual=JSON.stringify(restoredColumns)===JSON.stringify(source.columns);
  const unvalidated=Number(command(bin('psql'),['-X','-qAt','-v','ON_ERROR_STOP=1','-c',
    "SELECT count(*) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND c.contype IN ('f','c') AND c.convalidated IS NOT TRUE"],{env:targetEnv}));
  const valuesEqual=JSON.stringify(restored)===JSON.stringify(source.fingerprints);
  const byteEquality=hash(fs.readFileSync(archive))===archiveHash;
  const receipt={schemaVersion:scopeProfile==='catalog-v1'?1:2,...(scopeProfile==='catalog-v1'?{}:{scopeProfile}),environment:'production',scope:'catalog-data',method:'backup-restore',
    ...(scopeProfile==='observations-v1'?{observationDisposition:'empty-in-export-snapshot'}:{}),
    result:valuesEqual&&byteEquality&&schemaEqual&&unvalidated===0?'PASS':'FAIL',restoredAt:new Date().toISOString(),
    migrationManifestSha256:manifestSha256,backupSha256:archiveHash,restoredBackupSha256:hash(fs.readFileSync(archive)),
    coverage:{tables,tableDefinitions:true,internalConstraints:true,allRowValueHashes:true,
      authRows:false,authReferences:false,rls:false,triggers:false,rpcExecution:false,storageObjects:false},
    checks:{rowCounts:tables.every(t=>restored[t].count===source.fingerprints[t].count),
      identityReferences:valuesEqual&&unvalidated===0,representativeValues:valuesEqual,archiveBytes:byteEquality,tableShape:schemaEqual},
    sourceSchemaFingerprint:hash(JSON.stringify(source.columns)),sourceProjectionFingerprint:hash(JSON.stringify({rpc:source.rpc,view:source.masterViewSha256})),
    restoredSchemaFingerprint:hash(JSON.stringify(restoredColumns)),unvalidatedStructuralConstraints:unvalidated,
    tables:tables.map(t=>({name:t,rows:restored[t].count,rowSha256:restored[t].rowSha256})),
    restoreDatabase:restoreName,storageDisposition:'not-affected',
    limitations:['Catalog data and structural constraints only; not whole-database recovery.',
      'Auth-linked reviewer columns were proven NULL in the export snapshot; external Auth FK was not restored.',
      'Any observation references outside the fixed table set were proven NULL in the export snapshot; populated observations require a broader recovery scope.',
      'RLS, triggers, general indexes, RPC execution and managed Auth/Storage services are not certified.']};
  fs.writeFileSync(path.join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  return {result:receipt.result,scope:receipt.scope,restoreDatabase:restoreName,backupSha256:archiveHash,
    scopeProfile,tableCount:tables.length,totalRows:receipt.tables.reduce((s,t)=>s+t.rows,0),receipt:path.relative(ROOT,path.join(directory,'receipt.json'))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),envIndex=args.indexOf('--source-env-file'),caIndex=args.indexOf('--source-ca'),scopeIndex=args.indexOf('--scope-profile');
  catalogRecovery({envFile:envIndex<0?null:args[envIndex+1],sourceCa:caIndex<0?null:args[caIndex+1],
    scopeProfile:scopeIndex<0?'catalog-v1':args[scopeIndex+1],execute:args.includes('--execute')})
    .then(result=>console.log(JSON.stringify(result)))
    .catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'unexpected_recovery_failure'}));process.exitCode=1;});
}
