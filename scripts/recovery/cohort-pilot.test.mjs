import assert from 'node:assert/strict';
import test from 'node:test';
import {pilotPlan as makePlan,rehearsePilot as rehearse,rollbackSql,preparationSql,unaffectedSql} from './cohort-pilot.mjs';
import {syntheticPilotSource} from './cohort-synthetic-fixture.mjs';
const source=syntheticPilotSource();
const pilotPlan=()=>makePlan(source),rehearsePilot=options=>rehearse({...options,source});

test('synthetic pilot still rejects changed SQL and observation bytes before execution',()=>{
  assert.throws(()=>makePlan({...syntheticPilotSource(),pilotSha256:'0'.repeat(64)}),/pilot_sql_changed/);
  assert.throws(()=>makePlan({...syntheticPilotSource(),observationSha256:'0'.repeat(64)}),/observation_changed/);
});

test('pilot defaults to a stable read-only plan and requires its exact digest to execute',async()=>{
  const plan=await rehearsePilot();
  assert.equal(plan.result,'PLAN');
  assert.equal(plan.localWrites,false);
  assert.equal(plan.remoteReads,false);
  assert.equal(plan.remoteWrites,false);
  assert.deepEqual(await rehearsePilot(),plan);
  await assert.rejects(rehearsePilot({execute:true}),/pilot_exact_digest_confirmation_required/);
  await assert.rejects(rehearsePilot({execute:true,confirmDigest:'0'.repeat(64)}),/pilot_exact_digest_confirmation_required/);
  await assert.rejects(rehearsePilot({execute:true,confirmDigest:plan.planSha256}),/pilot_retained_recovery_inputs_required/);
});

test('mutation is explicitly labelled and retains original source times and product identity',()=>{
  const {sql}=pilotPlan();
  assert.match(sql.mutation,/MUTATION ARTIFACT/);
  assert.ok(sql.mutation.trim().endsWith('COMMIT;'));
  assert.ok(!sql.mutation.includes('DRY PLAN ONLY'));
  for(const value of ['5900340003615','2026-09-05T10:27:34.904106Z','2026-04-01T09:46:00Z'])assert.ok(sql.mutation.includes(value));
  assert.match(preparationSql(),/pilot_requires_empty_observation_baseline/);
  assert.match(preparationSql(),/pilot_identity_not_unique/);
  assert.match(sql.verify,/trans_fat_g IS NULL AND fibre_g IS NULL/);
});

test('operational reversal retains immutable observations and refuses drift',()=>{
  assert.ok(!/DELETE FROM public\.(product_source_observations|ingestion_batches|product_source_records)\b/i.test(rollbackSql));
  assert.ok(!/DISABLE TRIGGER|session_replication_role|TRUNCATE/i.test(rollbackSql));
  assert.match(rollbackSql,/pilot_reversal_refuses_concurrent_change/);
  assert.match(rollbackSql,/selected_observation_id=NULL/);
  assert.match(rollbackSql,/immutableObservationRetained/);
  assert.match(rollbackSql,/canonicalReadModelRestored/);
  assert.match(rollbackSql,/legacy_unverified/);
  assert.match(rollbackSql,/product_source_records WHERE id=.*FOR UPDATE/);
  assert.match(rollbackSql,/product_field_provenance WHERE product_id=178 FOR UPDATE/);
  assert.match(rollbackSql,/AND observation_id=\(SELECT id FROM recovery_pilot.observation_after\)/);
  assert.match(unaffectedSql(),/formula_source_hashes/);
  assert.match(unaffectedSql(),/scoring_model_versions/);
});
