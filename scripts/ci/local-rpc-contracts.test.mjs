import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertCompleteRpcReport } from './local-rpc-contracts.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = name => readFileSync(path.join(root, name), 'utf8');
const complete = () => ({success:true,numTotalTests:31,numPassedTests:31,numFailedTests:0,numPendingTests:0,testResults:[{assertionResults:Array.from({length:31},()=>({status:'passed'}))}]});

test('RPC result requires exactly 31 executed assertions, never skipped or partial success',()=>{
  assert.doesNotThrow(()=>assertCompleteRpcReport(complete()));
  for (const patch of [{success:false},{numTotalTests:30},{numPassedTests:30},{numFailedTests:1},{numPendingTests:1},{testResults:[]}])
    assert.throws(()=>assertCompleteRpcReport({...complete(),...patch}));
  const skipped=complete(); skipped.testResults[0].assertionResults[0].status='pending';
  assert.throws(()=>assertCompleteRpcReport(skipped));
});

test('RPC CI shares the candidate local runtime and fails closed on a skipped step',()=>{
  const workflow=read('.github/workflows/quality-gate.yml');
  assert.equal(existsSync(path.join(root,'.github/workflows/api-contract.yml')),false);
  assert.equal((workflow.match(/local-supabase-ci.sh start/g)??[]).length,1);
  const start=workflow.indexOf('id: local_supabase_start');
  const preflight=workflow.indexOf('id: auth_preflight');
  const rpc=workflow.indexOf('id: rpc_contracts');
  const stop=workflow.indexOf('id: local_supabase_stop');
  assert.ok(start<preflight && preflight<rpc && rpc<stop);
  assert.match(workflow,/name: RPC Contract Validation\s+needs: quality_gate\s+if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow,/run: test "\$RPC_RESULT" = success/);
  assert.doesNotMatch(workflow,/secrets\.(?:SUPABASE|NEXT_PUBLIC_SUPABASE)/);
  assert.doesNotMatch(workflow,/visual-safety:lighthouse/);
});

test('RPC runner reuses guarded readiness and credentials without exposing diagnostics',()=>{
  const runner=read('scripts/ci/local-rpc-contracts.mjs');
  assert.match(runner,/preflightLocalEmulator\(contract, runtime\)/);
  assert.match(runner,/sanitizedChildEnvironment\(process.env/);
  assert.match(runner,/RPC_CONTRACT_CANDIDATE_OVERRIDE_DENIED/);
  assert.match(runner,/env.INTEGRATION = '1'/);
  assert.match(runner,/::add-mask::/);
  assert.doesNotMatch(runner,/write\(result\.(?:stdout|stderr)/);
  const integration=read('frontend/src/lib/rpc-contracts/__tests__/contracts.integration.test.ts');
  assert.match(integration,/\["localhost", "127.0.0.1", "\[::1\]"\]/);
});
