import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {buildProductionPlan,productionOperate,assertExecutionBindings,transportEnvironment,verifySession,parseOptions,validateDumpArguments,executeScopedDump,operatorExitCode} from './cohort-production-operator.mjs';
import {TARGET,rollbackInSession,inspectOutcome} from './cohort-pilot-operator.mjs';
import {RecoveryError} from './catalog-recovery.mjs';
import {scopeTables} from './catalog-recovery.mjs';
import {inspectBatchOutcome} from './cohort-batch.mjs';

function fixture() {
  const head='a'.repeat(40),counts={remote:0,connect:0,apply:0,store:0,receipt:0,close:0};
  const authority={sourceHead:head,mainHead:head,dirty:false,repository:'ericsocrat/tryvit',code:{'synthetic.mjs':'b'.repeat(64)}};
  const deps={authority:()=>structuredClone(authority),caHash:()=> 'c'.repeat(64),
    inputs:()=>({pilot:{planSha256:'d'.repeat(64),migrationManifestSha256:'e'.repeat(64),proof:{receiptSha256:'f'.repeat(64)},
      privateInput:'SYNTHETIC_PRIVATE_MARKER'}}),
    remoteMain:()=>{counts.remote++;return head;},connect:async()=>{counts.connect++;return {
      query:async()=>JSON.stringify({strings:'on',database:'postgres',user:'postgres',readOnly:'off'}),close:async()=>{counts.close++;}};},
    store:()=>{counts.store++;return {directory:path.resolve('backups/synthetic-not-created'),save:()=> 'hash',close(){}};},
    applyPilot:async()=>{counts.apply++;return {result:'APPLIED',remoteWrites:true};},receipt:()=>{counts.receipt++;}};
  const options={action:'pilot',sourceCa:'synthetic-ca-not-read',target:TARGET,sourceHead:head,mainHead:head};
  options.confirmDigest=buildProductionPlan(options,deps).summary.planSha256;
  return {options,deps,counts,authority};
}

test('default planning is offline, has no writes, and does not expose input records',async()=>{
  const {options,deps,counts}=fixture();
  const result=await productionOperate(options,deps);
  assert.equal(result.result,'PLAN_READY_FOR_REVIEW');
  assert.equal(counts.remote+counts.connect+counts.apply+counts.store,0);
  assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_MARKER'));
});

test('recipient and TLS cannot be overridden by ambient libpq configuration',()=>{
  const env=transportEnvironment({password:'synthetic-only',caPath:path.resolve('synthetic-ca'),readOnly:true,
    environment:{PGHOST:'evil',PGSSLMODE:'disable',PGSERVICE:'evil',PATH:'path'}});
  assert.equal(env.PGHOST,'aws-1-eu-west-1.pooler.supabase.com');assert.equal(env.PGUSER,'postgres.'+TARGET);
  assert.equal(env.PGSSLMODE,'verify-full');assert.equal(env.PGSERVICE,undefined);
  assert.match(env.PGOPTIONS,/standard_conforming_strings=on/);assert.match(env.PGOPTIONS,/default_transaction_read_only=on/);
});

test('source/main/code/project drift prevents connection and mutation',async()=>{
  const {options,deps,counts,authority}=fixture();
  const plan=buildProductionPlan(options,deps);
  for(const change of [a=>a.dirty=true,a=>a.sourceHead='b'.repeat(40),a=>a.mainHead='b'.repeat(40),a=>a.code.changed='x']) {
    const current=structuredClone(authority);change(current);
    assert.throws(()=>assertExecutionBindings(options,plan,current,authority.mainHead));
  }
  await assert.rejects(productionOperate({...options,execute:true},{...deps,remoteMain:()=> 'b'.repeat(40)}),/exact_reviewed/);
  assert.equal(counts.connect+counts.apply,0);
});

test('missing populated producer never accepts a clone-only or self-labelled proof',async()=>{
  const {options,deps,counts}=fixture();
  const inputs=()=>({manifest:{sha256:'b'.repeat(64)},entries:[{productId:123}],populatedProducerReady:false,
    populatedProof:{result:'PASS',productionRecoveryCertified:true,receiptSha256:'c'.repeat(64)}});
  await assert.rejects(productionOperate({...options,action:'batch',execute:true},{...deps,inputs}),/producer_not_integrated/);
  assert.equal(counts.remote+counts.connect+counts.store,0);
});

test('SQL string mode failure is rejected before creating envelopes or applying',async()=>{
  const {options,deps,counts}=fixture();
  await assert.rejects(productionOperate({...options,execute:true},{...deps,connect:async()=>({
    query:async()=>JSON.stringify({strings:'off',database:'postgres',user:'postgres',readOnly:'off'}),close:async()=>{}})}),/sql_settings/);
  assert.equal(counts.store+counts.apply,0);
  await assert.rejects(verifySession({query:async()=>JSON.stringify({strings:'on',database:'postgres',user:'postgres',readOnly:'off'})},{readOnly:true}));
});

test('acknowledged apply succeeds once; uncertain commit is never retried',async()=>{
  const good=fixture();const result=await productionOperate({...good.options,execute:true},good.deps);
  assert.equal(result.result,'APPLIED');assert.equal(good.counts.apply,1);assert.equal(good.counts.receipt,1);
  const bad=fixture();bad.deps.applyPilot=async()=>{bad.counts.apply++;throw new RecoveryError('operator_commit_outcome_uncertain_inspect_envelope_no_retry');};
  await assert.rejects(productionOperate({...bad.options,execute:true},bad.deps),error=>/uncertain/.test(error.code)&&Boolean(error.envelopeDirectory));
  assert.equal(bad.counts.apply,1);assert.equal(bad.counts.receipt,0);assert.equal(bad.counts.close,1);
});

test('strict CLI refuses ambiguous flags and oversized or duplicate batches',()=>{
  assert.deepEqual(parseOptions([]),{});
  for(const args of [['--execute','--execute'],['--bogus'],['--action'],['--ids','1'],['--ids','1,1'],['--ids','1,2,3,4,5,6']])assert.throws(()=>parseOptions(args));
  assert.deepEqual(parseOptions(['--action','batch','--ids','1,2']).productIds,[1,2]);
});

test('pilot rollback preserves unrelated later batches but rejects target drift',async()=>{
  const before={product:{product_id:178,brand:'old'},nutrition:{calories:'1.00'},provenance:[],assertions:[],source:null,observations:[],
    sourceCounts:[0,0,0,0],unaffected:{products:'old'},model:{evidence:{state:'legacy_unverified'}}};
  const after={...structuredClone(before),product:{product_id:178,brand:'new'},source:{id:'synthetic-source',product_id:178,selected_observation_id:'synthetic-observation'},
    observations:[{id:'synthetic-observation'}],sourceCounts:[1,1,1,0],model:{evidence:{state:'recorded'}}};
  const current={...structuredClone(after),sourceCounts:[55,55,55,502],unaffected:{products:'later-independent-state'}};
  const restored={...structuredClone(before),source:{...after.source,selected_observation_id:null},observations:after.observations,
    sourceCounts:current.sourceCounts,unaffected:current.unaffected};
  let n=0;const queries=[];
  const session={query:async sql=>{queries.push(sql);return sql.startsWith('SELECT jsonb_build_object')?JSON.stringify(n++?restored:current):'';}};
  assert.equal((await rollbackInSession(session,{before,after},()=> 'hash')).result,'REVERSED');
  assert.equal(inspectOutcome({before,after},restored),'REVERSED_MATCHING_BASELINE');
  const changed={...current,product:{...current.product,brand:'concurrent-edit'}};
  await assert.rejects(rollbackInSession({query:async sql=>sql.startsWith('SELECT jsonb_build_object')?JSON.stringify(changed):''},{before,after},()=> 'hash'),/concurrent_change/);
});

test('dump adapter accepts exact snapshot scopes and rejects redirects or plaintext files',()=>{
  const schema=['--format=custom','--schema-only','--no-large-objects','--snapshot=0001-0002-1'];
  validateDumpArguments(schema);
  const catalog=['--format=custom','--no-owner','--no-privileges','--no-large-objects','--snapshot=0001-0002-1',...scopeTables('observations-v1').map(t=>'--table=public.'+t)];
  validateDumpArguments(catalog);
  for(const args of [[...schema,'--host=evil'],[...schema,'--file=plain.dump'],[...schema,'--schema-only'],catalog.slice(0,-1),
    [...catalog,'--table=auth.users']])assert.throws(()=>validateDumpArguments(args));
});

test('capture stays behind the same source gates and receives exact reviewed binding',async()=>{
  const f=fixture(),binding={environment:'production',project:TARGET,sourceHead:f.authority.sourceHead};
  f.deps.inputs=()=>({captureManifest:{sha256:'d'.repeat(64)},binding});
  let calls=0;
  f.deps.captureTransport=()=>({synthetic:true});
  f.deps.capture=async input=>{calls++;assert.deepEqual(input.binding,binding);return {result:'PASS',environment:'synthetic-test'};};
  const options={...f.options,action:'capture'};
  options.confirmDigest=buildProductionPlan(options,f.deps).summary.planSha256;
  await productionOperate(options,f.deps);assert.equal(calls,0);
  assert.equal((await productionOperate({...options,execute:true},f.deps)).result,'PASS');
  assert.equal(calls,1);assert.equal(f.counts.connect,0);
});

test('batch commits remain per-member and uncertain state is not reported as no writes',async()=>{
  const f=fixture();
  f.deps.inputs=()=>({manifest:{sha256:'d'.repeat(64)},entries:[{productId:1},{productId:2}],populatedProducerReady:true,
    populatedProof:{receiptSha256:'e'.repeat(64)}});
  let calls=0;
  f.deps.applyBatch=async args=>{calls++;assert.deepEqual(args.productIds,[1,2]);args.storeFor({productId:1});
    return {result:'HOLD',results:[{productId:1,result:'HOLD',code:'cohort_commit_uncertain_inspect_no_retry'}],remainingNotAttempted:[2]};};
  const options={...f.options,action:'batch'};options.confirmDigest=buildProductionPlan(options,f.deps).summary.planSha256;
  const result=await productionOperate({...options,execute:true},f.deps);
  assert.equal(result.remoteWrites,null);assert.equal(result.writeDisposition,'UNKNOWN_RECONCILE_NO_RETRY');assert.equal(calls,1);
  assert.deepEqual(result.remainingNotAttempted,[2]);assert.equal(result.envelopes.length,1);
  assert.equal(operatorExitCode(result,{execute:true}),1);
});

test('executed failed, partial, uncertain and unknown receipts exit nonzero without modifying evidence',()=>{
  for(const result of [
    {result:'HOLD',results:[{result:'APPLIED'},{result:'HOLD'}],envelopes:[{directory:'sanitized'}]},
    {result:'HOLD',writeDisposition:'UNKNOWN_RECONCILE_NO_RETRY',remoteWrites:null},
    {result:'PASS',writeDisposition:'UNKNOWN_RECONCILE_NO_RETRY'},
    {result:'DRIFT_REQUIRES_REVIEW'}, {result:'FAIL'}, {result:'UNRECOGNIZED'}, null,
  ]) {
    const before=structuredClone(result);
    assert.equal(operatorExitCode(result,{execute:true}),1);
    assert.deepEqual(result,before);
  }
  for(const result of ['PASS','APPLIED','REVERSED','PUBLIC_ALLOWLIST_PROPOSAL',
    'APPLIED_MATCHING_POSTIMAGE','NOT_APPLIED_MATCHING_PREIMAGE','REVERSED_MATCHING_BASELINE'])
    assert.equal(operatorExitCode({result},{execute:true}),0);
  assert.equal(operatorExitCode({result:'PLAN_BLOCKED'}),0);
  assert.equal(operatorExitCode({result:'PLAN_READY_FOR_REVIEW'}),0);
});

test('batch read-only inspection distinguishes reversed target and changed source mapping',()=>{
  const before={product:{product_id:123,name:'old'},nutrition:{value:'1.00'},source:null,provenance:[],assertions:[],observations:[],
    identityIds:[123],competingNames:[],model:{state:'legacy'},unaffected:{other:'before'}};
  const after={...structuredClone(before),product:{product_id:123,name:'new'},source:{id:'source',product_id:123,country:'PL',selected_observation_id:'observation'},
    observations:[{id:'observation'}],model:{state:'recorded'}};
  const restored={...structuredClone(before),source:{...after.source,selected_observation_id:null},observations:after.observations,unaffected:{other:'later'}};
  assert.equal(inspectBatchOutcome({before,after},restored),'REVERSED_MATCHING_BASELINE');
  assert.equal(inspectBatchOutcome({before,after},{...restored,source:{...restored.source,country:'DE'}}),'DRIFT_REQUIRES_REVIEW');
});

test('pg_dump bounds process/query time, hides its window and clears failed partial buffers',()=>{
  const args=['--format=custom','--schema-only','--no-large-objects','--snapshot=0001-0002-1'];
  for(const failure of [{status:1},{status:null,error:Object.assign(new Error('synthetic private diagnostic'),{code:'ETIMEDOUT'})}]) {
    const stdout=Buffer.from('synthetic partial archive'),stderr=Buffer.from('synthetic private diagnostic'),extra=Buffer.from('partial output copy');
    let calls=0;
    assert.throws(()=>executeScopedDump(args,{PGOPTIONS:'-c standard_conforming_strings=on'},(executable,actualArgs,options)=>{
      calls++;assert.equal(executable,'pg_dump');assert.deepEqual(actualArgs,args);
      assert.equal(options.timeout,120000);assert.equal(options.windowsHide,true);assert.equal(options.shell,false);
      assert.match(options.env.PGOPTIONS,/standard_conforming_strings=on/);assert.match(options.env.PGOPTIONS,/statement_timeout=120000/);
      return {...failure,stdout,stderr,output:[null,stdout,stderr,extra]};
    }),error=>error.code==='production_scoped_dump_failed'&&!error.message.includes('private'));
    assert.equal(calls,1);assert.ok(stdout.every(v=>v===0));assert.ok(stderr.every(v=>v===0));assert.ok(extra.every(v=>v===0));
  }
  const stdout=Buffer.from('synthetic valid archive'),stderr=Buffer.from('synthetic warning');
  assert.equal(executeScopedDump(args,{PGOPTIONS:''},()=>({status:0,stdout,stderr})),stdout);
  assert.equal(stdout.toString(),'synthetic valid archive');assert.ok(stderr.every(v=>v===0));
});
