/** Offline B governance regression against a real restored schema/catalog. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,validateManifest} from '../ci/database-release.mjs';
import {schemaCatalogRecovery} from './schema-catalog-recovery.mjs';
import {parseTap} from './migration-integration.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
if(!args.includes('--execute'))throw new Error('explicit_offline_execution_required');
const manifestBytes=fs.readFileSync(path.join(ROOT,'docs/releases/evidence-first-foundation.migrations.json'));
const manifest=JSON.parse(manifestBytes);validateManifest(ROOT,manifest);
const checks=[['security_posture',[8,9,27]],['scale_guardrails',[13]],['lists_comparisons',[3]],['index_temporal',[19]],['index_verification',[13]]];
let result;
try {
 result=await schemaCatalogRecovery({catalogDirectory:value('--catalog-directory'),schemaDirectory:value('--schema-directory'),
  manifestSha256:hash(manifestBytes),execute:true,writeReceipt:false,onVerifiedRestore:async context=>{
   context.restoreDatabaseAuthority(JSON.parse(fs.readFileSync(value('--database-authority'))));
   for(const entry of manifest.migrations)context.sqlAsPostgres(fs.readFileSync(path.join(ROOT,entry.path),'utf8'),'qa_migration');
   context.installPgTap();
   const prelude=fs.readFileSync(path.join(ROOT,'db/qa/contracts/evidence_security.sql'),'utf8');
   const tests=fs.readFileSync(path.join(ROOT,'db/qa/contracts/evidence_security.test.sql'),'utf8');
   const mutations=parseTap(context.sqlAsPostgres('SET search_path=public,extensions;\n'+prelude+'\n'+tests,'qa_mutations'),21);
   const outcomes=[];
   for(const [suite,numbers] of checks) {
    const file=fs.readFileSync(path.join(ROOT,`db/qa/QA__${suite}.sql`),'utf8');
    const selected=numbers.map(n=>{
     const match=file.match(new RegExp(`SELECT '${n}\\.[\\s\\S]*?;`));
     if(!match)throw new Error('qa_check_missing');return match[0];
    });
    const rows=context.sqlAsPostgres(prelude+'\n'+selected.join('\n'),'qa_checks').trim().split(/\r?\n/).filter(Boolean);
    const parsed=rows.map(row=>{const [name,count]=row.split('|');return {name,violations:Number(count)};});
    const outcome={suite,checks:parsed,result:parsed.length===numbers.length&&parsed.every(r=>Number.isFinite(r.violations)&&r.violations===0)?'PASS':'FAIL'};
    if(suite==='security_posture'&&parsed[1]?.violations) {
     const diagnostic=selected[1].replace(/^SELECT[\s\S]*?FROM pg_proc/,'SELECT p.oid::regprocedure::text FROM pg_proc');
     outcome.anonymousUnexpectedSignatures=context.sqlAsPostgres(prelude+'\n'+diagnostic,'qa_anon_diagnostic').trim().split(/\r?\n/);
    }
    outcomes.push(outcome);
   }
   return {result:mutations.result==='PASS'&&outcomes.every(r=>r.result==='PASS')?'PASS':'FAIL',mutations,outcomes};
  }});
}catch{result={result:'HOLD',code:'offline_qa_contract_verification_failed'};}
const report={checkedAt:new Date().toISOString(),migrationManifestSha256:hash(manifestBytes),remoteReads:false,remoteWrites:false,...result};
const reportPath=path.join(ROOT,'audit-reports/recovery/qa-contract-'+Date.now()+'.json');
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,reportPath}));
if(result.result!=='PASS')process.exitCode=1;
