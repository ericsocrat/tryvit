/** Apply only the approved manifest to the real restored, network-none clone. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,validateManifest} from '../ci/database-release.mjs';
import {RecoveryError} from './catalog-recovery.mjs';
import {schemaCatalogRecovery} from './schema-catalog-recovery.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const SUITES=Object.freeze([
  ['supabase/tests/evidence_first_ingestion.test.sql',51],
  ['supabase/tests/evidence_first_read_model.test.sql',44],
  ['supabase/tests/evidence_first_search.test.sql',37],
  ['supabase/tests/evidence_first_collections.test.sql',26],
  ['supabase/tests/public_share_evidence.test.sql',44],
  ['supabase/tests/operator_sql_repairs.test.sql',20],
]);
export const CONSUMER_SUITES=Object.freeze([
  ['supabase/tests/score_interpretation_retirement.test.sql',39],
  ['supabase/tests/evidence_first_home.test.sql',43],
  ['supabase/tests/evidence_first_scan.test.sql',29],
  ['supabase/tests/evidence_first_legacy_api_retirement.test.sql',127],
  ['supabase/tests/evidence_classification_image_lineage.test.sql',14],
  ['supabase/tests/evidence_profile_validator.test.sql',39],
  ['supabase/tests/evidence_compute_score_registry.test.sql',5],
]);
export function integrationSuites(manifestPath) {
  if(manifestPath==='docs/releases/evidence-first-foundation.migrations.json')return SUITES;
  if(manifestPath==='docs/releases/evidence-first-consumer.migrations.json')return CONSUMER_SUITES;
  throw new RecoveryError('unreviewed_integration_manifest');
}
export function parseTap(text,expected) {
  const plans=[...text.matchAll(/^1\.\.(\d+)\s*$/gm)].map(x=>Number(x[1]));
  const successes=[...text.matchAll(/^ok (\d+)\b/gm)].map(x=>Number(x[1]));
  const failures=[...text.matchAll(/^not ok (\d+)\b/gm)].map(x=>Number(x[1]));
  const skipped=/^ok \d+.*#\s*(?:SKIP|TODO)/im.test(text);
  const exactNumbering=successes.every((value,index)=>value===index+1);
  const pass=plans.length===1&&plans[0]===expected&&successes.length===expected&&failures.length===0&&!skipped&&exactNumbering;
  return {result:pass?'PASS':'FAIL',expected,passed:successes.length,failedIndices:failures,
    exactPlan:plans.length===1&&plans[0]===expected,noSkippedAssertions:!skipped,exactNumbering};
}
export function withLocalFixtures(file,sql) {
  let result=sql.replaceAll('\r\n','\n');
  const adaptations=[];
  if(file.endsWith('evidence_first_search.test.sql')) {
    result=result.replace('BEGIN;','BEGIN;\n'+
      "INSERT INTO public.api_rate_limits(endpoint,max_requests,window_seconds,description) VALUES "+
      "('api_search_products',30,60,'SYNTHETIC integration fixture matching repository default') ON CONFLICT DO NOTHING;");
    adaptations.push('Synthetic repository-default rate-limit config; not a production-config restoration claim');
  }
  if(file.endsWith('evidence_first_collections.test.sql')) {
    const original="SET LOCAL session_replication_role=replica;\n"+
      "INSERT INTO public.user_product_list_items(list_id,product_id,position,notes) VALUES('dddddddd-3333-4333-8333-333333333333',990999999,30,'Orphan fixture note');\n"+
      'SET LOCAL session_replication_role=origin;';
    if(!result.includes(original))throw new RecoveryError('orphan_fixture_source_changed');
    result=result.replace(original,'SELECT recovery_fixture.insert_fixed_orphan();');
    adaptations.push('Fixed-value local-only corruption helper replaces superuser-only fixture setup; all assertions remain managed-role');
  }
  if(file.endsWith('evidence_first_home.test.sql')) {
    const original="SET LOCAL session_replication_role='replica';\n"+
      "INSERT INTO public.user_product_views(user_id,product_id,viewed_at) VALUES('ffffffff-2222-4222-8222-222222222222',9000001,now());\n"+
      'INSERT INTO public.user_product_list_items(list_id,product_id,position)\n'+
      "SELECT id,9000001,-1 FROM public.user_product_lists WHERE user_id='ffffffff-2222-4222-8222-222222222222' AND list_type='favorites';\n"+
      "SET LOCAL session_replication_role='origin';";
    if(!result.includes(original))throw new RecoveryError('home_orphan_fixture_source_changed');
    result=result.replace(original,'SELECT recovery_fixture.insert_fixed_home_orphans();');
    adaptations.push('Fixed-value local-only Home corruption helper replaces superuser-only fixture setup; assertions remain managed-role');
  }
  return {sql:result,adaptations};
}
export async function integrate({catalogDirectory,schemaDirectory,manifestPath='docs/releases/evidence-first-foundation.migrations.json',
  databaseAuthorityPath,execute=false}) {
  const suites=integrationSuites(manifestPath);
  const manifestBytes=fs.readFileSync(path.join(ROOT,manifestPath)),manifest=JSON.parse(manifestBytes);
  validateManifest(ROOT,manifest);
  const consumer=suites===CONSUMER_SUITES;
  if(manifest.scope!=='schema-and-catalog'||manifest.migrations.length!==(consumer?7:5) ||
    (manifest.recoveryProfile??'catalog-v1')!==(consumer?'consumer-v1':'catalog-v1'))throw new RecoveryError('integration_scope_changed');
  const digest=hash(manifestBytes);
  if(!databaseAuthorityPath)throw new RecoveryError('database_level_authority_required');
  const databaseAuthority=JSON.parse(fs.readFileSync(path.resolve(ROOT,databaseAuthorityPath),'utf8'));
  if(!execute)return {result:'PREPARED',migrationManifestSha256:digest,migrationCount:5,remoteReads:false};
  const outcomes=[];
  let result,lintOutcome;
  try {
    result=await schemaCatalogRecovery({catalogDirectory,schemaDirectory,manifestSha256:digest,execute:true,writeReceipt:false,
      scopeProfile:manifest.recoveryProfile??'catalog-v1',
      onVerifiedRestore:async context=>{
        const databasePrivileges=context.restoreDatabaseAuthority(databaseAuthority);
        if(!Object.values(databasePrivileges).every(v=>v===true))throw new RecoveryError('database_privilege_restore_mismatch');
        const role=JSON.parse(context.sqlAsPostgres("SELECT jsonb_build_object('name',current_user,'super',rolsuper,'bypassRls',rolbypassrls) FROM pg_roles WHERE rolname=current_user;",'managed_role'));
        if(role.name!=='postgres'||role.super!==context.originalPostgresAttributes.super||role.bypassRls!==context.originalPostgresAttributes.bypassRls)
          throw new RecoveryError('original_managed_role_not_preserved');
        for(const entry of manifest.migrations) {
          const sql=fs.readFileSync(path.join(ROOT,entry.path),'utf8');
          if(hash(Buffer.from(sql))!==entry.sha256)throw new RecoveryError('migration_changed_after_manifest_check');
          try {context.sqlAsPostgres(sql,'migration_'+path.basename(entry.path,'.sql'));outcomes.push({path:entry.path,result:'PASS'});}
          catch(error){outcomes.push({path:entry.path,result:'FAIL',code:error instanceof RecoveryError?error.code:'migration_failed'});throw error;}
        }
        const wholeDatabaseLint=context.lintManagedSchemas();lintOutcome=wholeDatabaseLint;
        if(wholeDatabaseLint.errors.length)throw new RecoveryError('whole_database_lint_errors_'+wholeDatabaseLint.errors.length);
        const pgTapVersion=context.installPgTap().trim();
        context.installOrphanFixture();
        const recomputedCaches=[];
        if(suites===CONSUMER_SUITES) {
          for(const view of ['v_product_confidence','mv_ingredient_frequency','mv_product_similarity','mv_scoring_distribution','v_data_coverage_summary']) {
            context.sqlAsPostgres('REFRESH MATERIALIZED VIEW public.'+view+';','refresh_'+view);
            recomputedCaches.push(view);
          }
        }
        const tests=[];
        for(const [file,expected] of suites) {
          const sql=fs.readFileSync(path.join(ROOT,file),'utf8');
          if(!/\bBEGIN;/i.test(sql)||!sql.trim().endsWith('ROLLBACK;'))throw new RecoveryError('test_not_transaction_scoped');
          let parsed;
          const adapted=withLocalFixtures(file,sql);
          try {parsed=parseTap(context.sqlAsPostgres('SET search_path=public,extensions;\n'+adapted.sql,'test_'+path.basename(file,'.sql')),expected);}
          catch(error){parsed={result:'FAIL',expected,code:error instanceof RecoveryError?error.code:'test_execution_failed'};}
          tests.push({path:file,sha256:hash(Buffer.from(sql)),executedSha256:hash(Buffer.from(adapted.sql)),fixtureAdaptations:adapted.adaptations,...parsed});
        }
        return {result:tests.every(t=>t.result==='PASS')?'PASS':'FAIL',managedRole:role,databasePrivileges,
          databaseAuthorityCheckedAt:databaseAuthority.checkedAt,migrations:outcomes,wholeDatabaseLint,pgTapVersion,tests,
          recomputedCaches,cacheDisposition:'Derived caches recomputed from scoped restored rows, not historical cache-byte restoration',
          expectedAssertions:suites.reduce((sum,[,count])=>sum+count,0),passedAssertions:tests.reduce((sum,t)=>sum+(t.passed||0),0)};
      }});
  } catch(error) {
    result={result:'HOLD',code:error instanceof RecoveryError?error.code:'integration_failed',integration:{migrations:outcomes,wholeDatabaseLint:lintOutcome}};
  }
  const report={schemaVersion:1,method:'retained-production-schema-and-catalog-restore-plus-migrations',
    migrationManifestSha256:digest,checkedAt:new Date().toISOString(),remoteReads:false,remoteWrites:false,
    privateProductionRowsExported:false,originalRecoveryReceiptModified:false,databaseAuthorityCheckedAt:databaseAuthority.checkedAt,...result};
  fs.mkdirSync(path.join(ROOT,'audit-reports/recovery'),{recursive:true});
  const label=suites===CONSUMER_SUITES?'consumer':'foundation';
  fs.writeFileSync(path.join(ROOT,'audit-reports/recovery/'+label+'-integration-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  integrate({catalogDirectory:value('--catalog-directory'),schemaDirectory:value('--schema-directory'),
    manifestPath:value('--manifest')||undefined,databaseAuthorityPath:value('--database-authority'),execute:args.includes('--execute')})
    .then(report=>{console.log(JSON.stringify(report));if(report.result==='FAIL'||report.result==='HOLD')process.exitCode=1;})
    .catch(error=>{console.error(JSON.stringify({result:'HOLD',code:error instanceof RecoveryError?error.code:'integration_precondition_failed'}));process.exitCode=1;});
}
