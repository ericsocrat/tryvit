import assert from 'node:assert/strict';
import test from 'node:test';
import {validateCombinedBinding,captureCombinedPublicRecovery} from './combined-public-recovery.mjs';
import {scopeTables,validateScopeMetadata,sourceMetadata} from './catalog-recovery.mjs';
const binding={environment:'isolated-clone',project:'tryvit_recovery_probe_aabbccddeeff',sourceHead:'a'.repeat(40),
  migrationManifestSha256:'b'.repeat(64),codeSha256:'c'.repeat(64),publicAllowlistSha256:'d'.repeat(64)};
test('public profile is additive; defaults and empty-only21 remain exact',()=>{
  assert.equal(scopeTables().length,15);assert.equal(scopeTables('consumer-v1').length,17);
  assert.equal(scopeTables('observations-v1').length,21);assert.equal(scopeTables('observations-public-cohort-v1').length,21);
  const fingerprints=Object.fromEntries(scopeTables('observations-v1').map(t=>[t,{count:1,rowSha256:'a'.repeat(64)}]));
  assert.throws(()=>validateScopeMetadata({scopeProfile:'observations-v1',observationDisposition:'empty-in-export-snapshot',fingerprints},'observations-v1'),/populated/);
  assert.throws(()=>validateScopeMetadata({scopeProfile:'observations-public-cohort-v1',fingerprints},'observations-public-cohort-v1'),/review/);
});
test('binding rejects missing code, wrong project and non-exact authorities',()=>{
  assert.equal(validateCombinedBinding(binding),binding);
  for(const change of [{environment:'preview'},{sourceHead:'main'},{codeSha256:null},{migrationManifestSha256:'x'},
    {environment:'production',project:binding.project},{publicAllowlistSha256:null}])
    assert.throws(()=>validateCombinedBinding({...binding,...change}));
});
test('transport identity mismatch rejects before opening a session or exporting',async()=>{
  let opened=false,dumped=false;
  await assert.rejects(captureCombinedPublicRecovery({binding,reviewedSha256:binding.publicAllowlistSha256,
    transport:{identity:async()=>({environment:'production',project:'uskvezwftkkudvksmken'}),
      openSession:async()=>{opened=true;},pgDump:async()=>{dumped=true;}}}),/identity_mismatch/);
  assert.equal(opened,false);assert.equal(dumped,false);
});
test('public source metadata cannot bypass review with only the new profile name',async()=>{
  const columns=scopeTables('observations-public-cohort-v1').map(table=>({table,name:'id'}));
  await assert.rejects(sourceMetadata({query:async()=>JSON.stringify(columns)},'observations-public-cohort-v1'),/review_required/);
});
