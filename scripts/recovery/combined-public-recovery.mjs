/** Same-snapshot populated public cohort + full schema recovery. No remote transport. */
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {sourceMetadata,scopeTables,fingerprintQuery,dumpArgs,privateDirectory,RecoveryError,validateScopeMetadata} from './catalog-recovery.mjs';
import {SCHEMA_QUERIES,rolesQuery,membershipsQuery,supplementQuery,schemaCatalogRecovery} from './schema-catalog-recovery.mjs';
import {PROFILE,publicSnapshotSql,validatePublicAllowlist} from './cohort-public-recovery.mjs';
import {dpapi,encryptBytes,decryptBytes} from './opaque-containment.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hash=v=>createHash('sha256').update(v).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=code=>{throw new RecoveryError(code);};
const write=(file,bytes)=>{const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
export function validateCombinedBinding(binding) {
  if(!binding||!['production','isolated-clone'].includes(binding.environment)||
    !/^[a-z0-9_-]{8,80}$/.test(binding.project??'')||
    !/^[a-f0-9]{40}$/.test(binding.sourceHead??'')||
    !['migrationManifestSha256','codeSha256','publicAllowlistSha256'].every(k=>/^[a-f0-9]{64}$/.test(binding[k]??''))||
    (binding.environment==='production'&&binding.project!=='uskvezwftkkudvksmken'))fail('combined_binding_invalid');
  return binding;
}
export async function captureCombinedPublicRecovery({transport,manifest,reviewedSha256,binding,onVerifiedRestore=null}) {
  validateCombinedBinding(binding);
  if(binding.publicAllowlistSha256!==reviewedSha256)fail('combined_allowlist_binding_mismatch');
  // Transport construction and authenticated project discovery belong to the
  // reviewed operator. This module cannot connect to a cloud database itself.
  if(!equal(await transport.identity(),{environment:binding.environment,project:binding.project}))
    fail('combined_transport_identity_mismatch');
  let catalogArchive,schemaArchive;
  const key=randomBytes(32);
  const directory=path.join(ROOT,'backups','schema_catalog_'+Date.now()+'_'+randomBytes(3).toString('hex'));
  privateDirectory(directory);
  const session=await transport.openSession();
  try {
    await session.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TIME ZONE 'UTC'");
    const state=JSON.parse(await session.query("SELECT jsonb_build_object('readOnly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'))"));
    if(state.readOnly!=='on'||state.isolation!=='repeatable read')fail('combined_snapshot_not_read_only');
    // Includes every consumer17 privacy guard and exact reviewed public payloads.
    const catalog=await sourceMetadata(session,PROFILE,{manifest,reviewedSha256});
    catalog.fingerprints={};
    for(const table of scopeTables(PROFILE))catalog.fingerprints[table]=JSON.parse(await session.query(fingerprintQuery(table,PROFILE)));
    const source={};for(const [kind,query] of Object.entries(SCHEMA_QUERIES))source[kind]=JSON.parse(await session.query(query));
    const roles=JSON.parse(await session.query(rolesQuery));
    const memberships=JSON.parse(await session.query(membershipsQuery));
    const bootstrap=JSON.parse(await session.query(supplementQuery));
    if(bootstrap.extension!=='pg_graphql'||bootstrap.extensionVersion!=='1.5.11')fail('unexpected_bootstrap_dependency');
    const snapshot=(await session.query('SELECT pg_export_snapshot()')).trim();
    if(!/^[a-fA-F0-9-]+$/.test(snapshot))fail('combined_snapshot_identifier_invalid');
    catalogArchive=await transport.pgDump(dumpArgs('unused',snapshot,PROFILE).filter(a=>!a.startsWith('--file=')));
    schemaArchive=await transport.pgDump(['--format=custom','--schema-only','--no-large-objects',`--snapshot=${snapshot}`]);
    if(!Buffer.isBuffer(catalogArchive)||!Buffer.isBuffer(schemaArchive)||!catalogArchive.length||!schemaArchive.length)
      fail('combined_archive_missing');
    const metadata={schemaVersion:1,scopeProfile:PROFILE,binding,capturedAt:new Date().toISOString(),
      source,roles,memberships,sourceMetadata:catalog,manifest,plainHash:hash(schemaArchive),catalogArchiveSha256:hash(catalogArchive)};
    write(path.join(directory,'schema.key.dpapi'),dpapi('protect',key));
    write(path.join(directory,'catalog.dump.enc'),encryptBytes(catalogArchive,key));
    write(path.join(directory,'schema.dump.enc'),encryptBytes(schemaArchive,key));
    write(path.join(directory,'metadata.enc'),encryptBytes(Buffer.from(JSON.stringify(metadata)),key));
    write(path.join(directory,'bootstrap-supplement-v2.enc'),encryptBytes(Buffer.from(JSON.stringify(bootstrap)),key));
  } finally {try{await session.close();}finally{key.fill(0);catalogArchive?.fill(0);schemaArchive?.fill(0);}}
  // No PASS is manufactured for capture. The existing full restore engine must
  // rebuild actual roles/schema/catalog/functions/grants/RLS and execute checks.
  const restored=await schemaCatalogRecovery({catalogDirectory:directory,schemaDirectory:directory,
    combinedCapture:{binding},scopeProfile:PROFILE,manifestSha256:binding.migrationManifestSha256,
    execute:true,onVerifiedRestore});
  const proof=loadCombinedPublicRecovery(directory,{expectedBinding:binding,requireRestored:true});
  proof.catalogArchive.fill(0);
  return {result:restored.result,directory,receipt:restored.receipt,binding,productionRecoveryCertified:binding.environment==='production'&&restored.result==='PASS'};
}
export function loadCombinedPublicRecovery(directory,{expectedBinding,requireRestored=true}) {
  validateCombinedBinding(expectedBinding);
  directory=path.resolve(directory);
  if(!directory.startsWith(path.join(ROOT,'backups','schema_catalog_'))||fs.realpathSync(directory)!==directory)
    fail('combined_archive_not_private');
  const key=dpapi('unprotect',fs.readFileSync(path.join(directory,'schema.key.dpapi')));
  let archive;
  try {
    const metadata=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,'metadata.enc')),key));
    if(metadata.schemaVersion!==1||metadata.scopeProfile!==PROFILE||!equal(metadata.binding,expectedBinding))fail('combined_capture_binding_mismatch');
    validateScopeMetadata(metadata.sourceMetadata,PROFILE);
    if(metadata.sourceMetadata.publicAllowlistSha256!==expectedBinding.publicAllowlistSha256)fail('combined_capture_allowlist_mismatch');
    archive=decryptBytes(fs.readFileSync(path.join(directory,'catalog.dump.enc')),key);
    if(hash(archive)!==metadata.catalogArchiveSha256)fail('combined_catalog_archive_mismatch');
    const schema=decryptBytes(fs.readFileSync(path.join(directory,'schema.dump.enc')),key);
    try{if(hash(schema)!==metadata.plainHash)fail('combined_schema_archive_mismatch');}finally{schema.fill(0);}
    let receipt=null;
    if(requireRestored) {
      receipt=JSON.parse(fs.readFileSync(path.join(directory,'receipt.json'),'utf8'));
      if(receipt.result!=='PASS'||receipt.scopeProfile!==PROFILE||receipt.scope!=='schema-and-catalog'||
        receipt.method!=='backup-restore'||!equal(receipt.binding,expectedBinding)||receipt.environment!==expectedBinding.environment||
        receipt.migrationManifestSha256!==expectedBinding.migrationManifestSha256||receipt.backupSha256!==metadata.plainHash||
        receipt.restoredBackupSha256!==metadata.plainHash||receipt.encryptedBackupSha256!==hash(fs.readFileSync(path.join(directory,'schema.dump.enc')))||
        receipt.catalogSha256!==hash(JSON.stringify(metadata.sourceMetadata.fingerprints))||receipt.restoredCatalogSha256!==receipt.catalogSha256||
        receipt.catalogTableCount!==21||!['schema','functions','grants','rls','roleAttributes','roleMemberships','extensionBootstrap',
          'rowCounts','identityReferences','representativeValues','syntheticRoles'].every(k=>receipt.checks?.[k]===true))
        fail('combined_restore_proof_incomplete');
    }
    return {...metadata,catalogArchive:archive,receipt,
      migrationManifestSha256:metadata.binding.migrationManifestSha256,
      receiptSha256:receipt?hash(fs.readFileSync(path.join(directory,'receipt.json'))):null};
  } catch(error){archive?.fill(0);throw error;}finally{key.fill(0);}
}
export async function assertCombinedFreshness(session,proof) {
  // Caller owns its mutation transaction and locks; this performs no writes.
  validatePublicAllowlist(JSON.parse(await session.query(publicSnapshotSql)),proof.manifest,proof.binding.publicAllowlistSha256);
  for(const table of scopeTables(PROFILE))if(!equal(JSON.parse(await session.query(fingerprintQuery(table,PROFILE))),proof.sourceMetadata.fingerprints[table]))
    fail('combined_live_catalog_drift');
  for(const [kind,query] of Object.entries(SCHEMA_QUERIES))if(!equal(JSON.parse(await session.query(query)),proof.source[kind]))fail('combined_live_schema_drift');
  if(!equal(JSON.parse(await session.query(rolesQuery)),proof.roles)||!equal(JSON.parse(await session.query(membershipsQuery)),proof.memberships))
    fail('combined_live_roles_drift');
  return true;
}
