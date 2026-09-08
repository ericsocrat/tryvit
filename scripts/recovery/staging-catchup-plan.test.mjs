import assert from 'node:assert/strict';
import test from 'node:test';
import {makePlan,validateMetadata,METADATA_SQL,PROJECT,VERSIONS} from './staging-catchup-plan.mjs';

test('historical staging catchup is exact, hash-pinned and never recovery proof',()=>{
  const plan=makePlan();
  assert.equal(plan.projectRef,PROJECT);
  assert.equal(plan.baselineVersions.length,227);
  assert.equal(plan.migrations.length,10);
  assert.ok(plan.migrations.every(m=>/^[a-f0-9]{64}$/u.test(m.sha256)));
  assert.ok(VERSIONS.every(v=>!plan.baselineVersions.includes(v)));
  assert.equal(plan.remoteWrites,false);
  assert.equal(plan.result,'PREPARED_NOT_CAPTURED_OR_RESTORED');
});
test('metadata cannot hide drift, missing sequence state, or claim restoration',()=>{
  const plan=makePlan();
  const metadata={baselineVersions:plan.baselineVersions,privateRowExports:false,
    triggerDefinitions:[{name:'synthetic-test-only'}],
    sequenceState:Object.fromEntries(plan.sequenceState.map(name=>[name,{lastValue:1,isCalled:false}]))};
  const report=validateMetadata(plan,metadata);
  assert.equal(report.recoveryProven,false);
  assert.equal(report.result,'METADATA_VALIDATED_NOT_RESTORED');
  for(const patch of [{baselineVersions:[]},{baselineVersions:[...metadata.baselineVersions,VERSIONS[0]]},
    {sequenceState:{}},{triggerDefinitions:[]},{privateRowExports:true}])
    assert.throws(()=>validateMetadata(plan,{...metadata,...patch}));
});
test('metadata SELECT excludes user rows and cannot advance sequences or create roles',()=>{
  assert.match(METADATA_SQL,/^SELECT /u);
  assert.doesNotMatch(METADATA_SQL,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|nextval|setval)\b/iu);
  assert.doesNotMatch(METADATA_SQL,/auth\.users|actor_id|product_name_en_reviewed_by|password/iu);
});
