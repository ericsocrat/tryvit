/** Actual local-only baseline reconstruction. Full metadata equality gates catchup. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {containmentArgs,assertContained,dpapi,decryptBytes,encryptBytes} from './opaque-containment.mjs';
import {SCHEMA_QUERIES,canonicalStructure} from './schema-catalog-recovery.mjs';
import {NORMALIZED_GRANTS_SQL,AUTHORITY_SQL} from './staging-read-capture.mjs';
import {makePlan,BASE,PROJECT} from './staging-catchup-plan.mjs';
import {managedBootstrap,managedFinish,canonicalGrantRows,restoreCapturedGrants,missingPolicySql} from './staging-managed-bootstrap.mjs';
import {initializeCapturedCatalog,prepareCatchupJournal,restoreCatchupJournal,lintForwardSchemas} from './staging-catalog-drill.mjs';
import {validateManifest} from '../ci/database-release.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=(ok,code)=>{if(!ok)throw Error(code);};
const firstValue=rows=>Object.values(rows[0]||{})[0];
export function captureDirectory(leaf) {
  fail(/^staging_capture_\d{13}_[a-f0-9]{8}$/u.test(leaf||''),'invalid_staging_capture_leaf');
  const directory=path.join(ROOT,'backups',leaf);
  fail(fs.realpathSync(directory)===path.resolve(directory),'redirected_capture_directory');return directory;
}
export async function reconstruct({leaf,supplementLeaf,stateLeaf,manifestSha256,execute=false}={}) {
  const plan=makePlan();
  if(!execute)return {result:'PREPARED_NOT_RECONSTRUCTED',projectRef:PROJECT,baselineCount:227,catchupCount:10,remoteWrites:false};
  const directory=captureDirectory(leaf),key=dpapi('unprotect',fs.readFileSync(path.join(directory,'key.dpapi')));
  let metadata,catalog,supplement,state;
  try {metadata=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,'metadata.enc')),key));
    catalog=decryptBytes(fs.readFileSync(path.join(directory,'catalog.enc')),key);
    if(supplementLeaf){fail(/^managed-metadata-\d{13}\.enc$/u.test(supplementLeaf),'invalid_supplement_leaf');
      supplement=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,supplementLeaf)),key));}
    if(stateLeaf){fail(/^recovery-state-\d{13}\.enc$/u.test(stateLeaf),'invalid_state_leaf');
      state=JSON.parse(decryptBytes(fs.readFileSync(path.join(directory,stateLeaf)),key));}
  } finally{key.fill(0);}
  fail(metadata.plan.projectRef===PROJECT&&metadata.plan.migrationSetSha256===plan.migrationSetSha256,'capture_plan_mismatch');
  fail(JSON.stringify(metadata.metadata.baselineVersions)===JSON.stringify(plan.baselineVersions),'capture_baseline_mismatch');
  const name='tryvit_recovery_probe_'+randomBytes(6).toString('hex');
  const report={result:'HOLD',method:'actual-staging-catalog-restore-with-verified-schema-reconstruction-and-catchup-inverse',
    projectRef:PROJECT,captureDirectoryLeaf:leaf,remoteReads:false,remoteWrites:false,
    privateRowsExported:false,sourceCommit:BASE,migrationsApplied:0,catchupsApplied:0,recoveryProven:false};
  let created=false;
  const run=(args,input,stage='docker')=>{
    const r=spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:32*1024*1024});
    if(r.status!==0){const state=r.stderr?.match(/(?:ERROR|FATAL):\s+([A-Z0-9]{5})\b/u)?.[1];
      const marker=[...r.stdout.matchAll(/^tryvit_step_(\d+)$/gmu)].at(-1)?.[1];
      throw Error('local_'+stage+(marker?'_'+marker:'')+'_'+(state||'failed'));}
    return r.stdout;
  };
  const sql=(text,user='postgres',stage='sql')=>run(['exec','-i',name,'psql','-X','-qAt','-h','/tmp','-U',user,'-d','postgres',
    '-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],text,stage);
  const batch=(statements,stage)=>sql(statements.map((s,i)=>'\\echo tryvit_step_'+i+'\n'+s+'\n;\n').join('\n'),'tryvit_recovery_operator',stage);
  try {
    const args=containmentArgs(name,{database:true,bootstrapUser:'tryvit_recovery_operator',locale:'en_US.UTF-8'});
    fail(args.at(-1).includes(' -U tryvit_recovery_operator '),'bootstrap_template_changed');
    // PostgreSQL records superuser role-membership grants under bootstrap OID10.
    // Match the source's actual bootstrap identity, retaining containment flags.
    args[args.length-1]=args.at(-1).replace(' -U tryvit_recovery_operator ',' -U supabase_admin ');
    run(args);created=true;
    let ready=false;for(let n=0;n<40;n++){
      if(spawnSync('docker',['exec',name,'pg_isready','-h','/tmp','-U','supabase_admin'],{stdio:'ignore',windowsHide:true}).status===0){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,500));
    }fail(ready,'isolated_database_not_ready');assertContained(JSON.parse(run(['inspect',name]))[0]);
    sql('CREATE ROLE tryvit_recovery_operator SUPERUSER LOGIN;','supabase_admin','bootstrap_operator');
    run(['exec','-e','POSTGRES_HOST=/tmp',name,'/bin/sh','/docker-entrypoint-initdb.d/migrate.sh'],undefined,'supabase_image_bootstrap');
    // Historical construction has pg_restore-like local bootstrap authority;
    // it is not a claim that old migrations run under today's hosted role.
    sql('ALTER ROLE postgres SUPERUSER;','tryvit_recovery_operator','historical_bootstrap_authority');
    report.historicalReplayAuthority='local-bootstrap-superuser-normalized-before-equality';
    if(supplement){
      for(const role of firstValue(metadata.preCaptureMetadata.authority).roles){
        fail(/^[a-z_][a-z0-9_]*$/u.test(role.name),'source_role_identifier_invalid');
        if(sql(`SELECT count(*) FROM pg_roles WHERE rolname='${role.name}';`,'tryvit_recovery_operator').trim()==='0')
          sql(`CREATE ROLE "${role.name}";`,'tryvit_recovery_operator','missing_source_role');
      }
      batch(managedBootstrap(firstValue(metadata.preCaptureMetadata.structure.schema),supplement),'managed_bootstrap');
      report.managedSupplement=supplementLeaf;
    }
    const files=execFileSync('git',['ls-tree','-r','--name-only',BASE,'--','supabase/migrations'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n')
      .filter(p=>plan.baselineVersions.includes(path.basename(p).slice(0,14))).sort();
    fail(files.length===227,'baseline_file_count_mismatch');
    const historicalSql=files.map((file,i)=>'\\connect postgres postgres\n\\echo tryvit_step_'+i+'\n'+
      execFileSync('git',['show',`${BASE}:${file}`],{cwd:ROOT,maxBuffer:32*1024*1024}).toString()+'\n;\n').join('\n');
    try {sql(historicalSql,'postgres','baseline_migration');report.migrationsApplied=files.length;report.lastMigration=path.basename(files.at(-1));}
    catch(error){const index=Number(error.message.match(/baseline_migration_(\d+)_/u)?.[1]||0);
      report.migrationsApplied=index;report.lastMigration=path.basename(files[index]);throw error;}
    if(supplement)batch(managedFinish(firstValue(metadata.preCaptureMetadata.structure.schema),supplement),'managed_finish');
    const capturedAuthority=firstValue(metadata.preCaptureMetadata.authority);
    if(!capturedAuthority.extensions.some(e=>e.name==='pg_graphql'))
      sql('DROP EXTENSION IF EXISTS pg_graphql;','tryvit_recovery_operator','remove_image_only_graphql_extension');
    for(const role of capturedAuthority.roles){
      fail(/^[a-z_][a-z0-9_]*$/u.test(role.name),'source_role_identifier_invalid');
      const exists=sql(`SELECT count(*) FROM pg_roles WHERE rolname='${role.name}';`,'tryvit_recovery_operator').trim()==='1';
      const attrs=`${role.super?'SUPERUSER':'NOSUPERUSER'} ${role.inherit?'INHERIT':'NOINHERIT'} ${role.createRole?'CREATEROLE':'NOCREATEROLE'}
        ${role.createDb?'CREATEDB':'NOCREATEDB'} ${role.login?'LOGIN':'NOLOGIN'} ${role.replication?'REPLICATION':'NOREPLICATION'} ${role.bypassRls?'BYPASSRLS':'NOBYPASSRLS'}`;
      sql(`${exists?'ALTER':'CREATE'} ROLE "${role.name}" ${attrs};`,'tryvit_recovery_operator','role_authority_normalization');
    }
    fail(sql("SELECT rolsuper FROM pg_roles WHERE rolname='postgres';",'tryvit_recovery_operator').trim()==='f','managed_role_still_superuser');
    report.forwardRoleSuperuser=false;
    if(!capturedAuthority.roles.some(r=>r.name==='supabase_superuser'))
      sql('DROP ROLE IF EXISTS supabase_superuser;','tryvit_recovery_operator','remove_image_only_role');
    if(supplement){
      sql(missingPolicySql(firstValue(metadata.preCaptureMetadata.structure.rls)).join('\n'),'tryvit_recovery_operator','source_policy_restore');
      batch(restoreCapturedGrants(firstValue(metadata.preCaptureMetadata.normalizedGrants),capturedAuthority,
        firstValue(metadata.preCaptureMetadata.structure.schema)),'source_grant_restore');
      for(const m of capturedAuthority.memberships){
        const quote=x=>'"'+x.replaceAll('"','""')+'"';
        sql(`BEGIN;SET LOCAL ROLE ${quote(m.grantor)};GRANT ${quote(m.role)} TO ${quote(m.member)} WITH ADMIN ${m.admin}, INHERIT ${m.inherit}, SET ${m.set};COMMIT;`,
          'tryvit_recovery_operator','source_membership_restore');
      }
    }
    const differences=[],localMetadata={},differenceCounts={};
    for(const [kind,query] of Object.entries(SCHEMA_QUERIES)){
      const actual=JSON.parse(sql(query,'tryvit_recovery_operator','fingerprint_'+kind));
      const expected=firstValue(metadata.preCaptureMetadata.structure[kind]);
      localMetadata[kind]=actual;
      const keyFor=r=>[r.kind,r.schema,r.table,r.name,r.args].map(v=>v||'').join('|');
      const left=new Map(expected.map(r=>[keyFor(r),r])),right=new Map(actual.map(r=>[keyFor(r),r]));
      differenceCounts[kind]={missing:[...left.keys()].filter(k=>!right.has(k)),added:[...right.keys()].filter(k=>!left.has(k)),
        changed:[...left.keys()].filter(k=>right.has(k)&&JSON.stringify(left.get(k))!==JSON.stringify(right.get(k)))};
      const canonical=value=>kind==='schema'?canonicalStructure(value):value;
      if(kind!=='grants'&&sha(JSON.stringify(canonical(actual)))!==sha(JSON.stringify(canonical(expected))))differences.push(kind);
    }
    const normalized=JSON.parse(sql(NORMALIZED_GRANTS_SQL,'tryvit_recovery_operator','normalized_grants'));
    if(sha(JSON.stringify(canonicalGrantRows(normalized)))!==sha(JSON.stringify(canonicalGrantRows(firstValue(metadata.preCaptureMetadata.normalizedGrants)))))differences.push('normalizedGrants');
    const authority=JSON.parse(sql(AUTHORITY_SQL,'tryvit_recovery_operator','authority'));
    const expectedAuthority=firstValue(metadata.preCaptureMetadata.authority);
    // The isolated bootstrap role is tooling; exclude exactly that one from the
    // comparison, retaining every actual source role and membership.
    authority.roles=authority.roles.filter(r=>r.name!=='tryvit_recovery_operator');
    delete authority.database.acl;delete expectedAuthority.database.acl; // compared semantically above, including grantors/options
    if(sha(JSON.stringify(authority))!==sha(JSON.stringify(expectedAuthority)))differences.push('authority');
    report.baselineDifferences=differences;
    const diagnosticKey=dpapi('unprotect',fs.readFileSync(path.join(directory,'key.dpapi')));
    const diagnosticLeaf='reconstruction-'+Date.now()+'.enc';
    try {fs.writeFileSync(path.join(directory,diagnosticLeaf),encryptBytes(Buffer.from(JSON.stringify({localMetadata,normalized,authority,differenceCounts})),diagnosticKey));}
    finally {diagnosticKey.fill(0);}
    report.encryptedDiagnosticLeaf=diagnosticLeaf;
    report.baselineDifferenceCounts=Object.fromEntries(Object.entries(differenceCounts).map(([kind,counts])=>[kind,Object.fromEntries(Object.entries(counts).map(([name,values])=>[name,values.length]))]));
    report.rawMetadataDifferenceCounts=report.baselineDifferenceCounts;
    report.normalizationExplanation='Raw counts include index-array order and NULL-versus-explicit default ACL representations. baselineDifferences is the blocking semantic comparison; ACL normalization retains grantors, grantees, privileges and grant options.';
    fail(differences.length===0,'baseline_metadata_equality_unproven');
    report.catalogArchiveSha256=sha(catalog);
    fail(state,'source_catalog_verification_state_required');
    assertContained(JSON.parse(run(['inspect',name]))[0]);
    report.catalogRestore=initializeCapturedCatalog({sql,metadata,state,sourceSchema:firstValue(metadata.preCaptureMetadata.structure.schema),
      restoreArchive:()=>run(['exec','-i',name,'pg_restore','-h','/tmp','-U','tryvit_recovery_operator','-d','postgres',
        '--exit-on-error','--data-only','--no-owner','--no-privileges'],catalog,'catalog_restore')});
    const journal=prepareCatchupJournal(sql);
    for(const entry of plan.migrations){const bytes=fs.readFileSync(path.join(ROOT,entry.path));fail(sha(bytes)===entry.sha256,'catchup_bytes_changed');
      sql(bytes,'postgres','managed_catchup');report.catchupsApplied++;}
    report.catchupEffects=JSON.parse(sql(`SELECT jsonb_build_object(
      'newAuditRows',(SELECT count(*) FROM public.product_change_log p WHERE NOT EXISTS(SELECT 1 FROM recovery_journal.product_change_log j WHERE j.id=p.id)),
      'newRefreshRows',(SELECT count(*) FROM public.mv_refresh_log p WHERE NOT EXISTS(SELECT 1 FROM recovery_journal.mv_refresh_log j WHERE j.refresh_id=p.refresh_id)),
      'newIngredientRows',(SELECT count(*) FROM public.ingredient_ref p WHERE NOT EXISTS(SELECT 1 FROM recovery_journal.ingredient_ref j WHERE j.ingredient_id=p.ingredient_id)));`,
      'tryvit_recovery_operator','catchup_effects'));
    fail(report.catchupEffects.newRefreshRows===5,'catchup_refresh_not_fully_exercised');
    report.inverse=restoreCatchupJournal(sql,journal);
    const manifestBytes=fs.readFileSync(path.join(ROOT,'docs/releases/evidence-first-foundation.migrations.json'));
    fail(manifestSha256&&sha(manifestBytes)===manifestSha256,'frozen_foundation_manifest_required');
    const manifest=JSON.parse(manifestBytes);validateManifest(ROOT,manifest,'staging');
    const forward=[...manifest.stagingPrerequisites,...manifest.migrations];fail(forward.length===15,'forward_set_not_fifteen');
    report.migrationManifestSha256=manifestSha256;report.forwardApplied=0;
    for(const entry of forward){const bytes=fs.readFileSync(path.join(ROOT,entry.path));fail(sha(bytes)===entry.sha256,'forward_bytes_changed');
      sql(bytes,'postgres','managed_forward');report.forwardApplied++;}
    report.forwardLint=lintForwardSchemas(sql);fail(report.forwardLint.errors.length===0,'forward_lint_errors');
    report.result='PASS';report.recoveryProven=true;
    report.scope='isolated-staging-catalog-schema-ten-catchup-inverse-and-fifteen-forward';
    report.privateRowsRestored=false;report.managedServiceStateRestored=false;
  } catch(error){report.code=/^[a-z0-9_]+$/u.test(error.message)?error.message:'local_reconstruction_failed';}
  finally {if(created){assertContained(JSON.parse(run(['inspect',name]))[0]);run(['rm','--force',name]);report.containerRemoved=true;}}
  report.checkedAt=new Date().toISOString();
  const receipts=path.join(ROOT,'audit-reports','recovery');fs.mkdirSync(receipts,{recursive:true});
  const receiptLeaf='staging-rehearsal-'+Date.now()+'.json';report.receiptLeaf=receiptLeaf;
  fs.writeFileSync(path.join(receipts,receiptLeaf),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),i=args.indexOf('--capture'),s=args.indexOf('--supplement'),r=args.indexOf('--state'),m=args.indexOf('--manifest-sha256');
  reconstruct({leaf:i<0?undefined:args[i+1],supplementLeaf:s<0?undefined:args[s+1],stateLeaf:r<0?undefined:args[r+1],
    manifestSha256:m<0?undefined:args[m+1],execute:args.includes('--execute')})
    .then(report=>{console.log(JSON.stringify(report));if(report.result==='HOLD')process.exitCode=1;})
    .catch(()=>{console.error(JSON.stringify({result:'HOLD',code:'reconstruction_precondition_failed',recoveryProven:false}));process.exitCode=1;});
}
