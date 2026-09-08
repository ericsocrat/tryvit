import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=file=>readFileSync(path.join(root,file),'utf8');

test('one guarded build per safety mode retains every existing project',()=>{
  const workflow=read('.github/workflows/quality-gate.yml');
  const launches=[...workflow.matchAll(/run: npm run visual-safety:(public|local-authenticated) -- ([^\n]+)/g)];
  assert.equal(launches.length,2);
  const expected={public:['quality-mobile','quality-desktop'],'local-authenticated':['quality-mobile','quality-desktop','private-pwa-cache','phase5a1-catalog','phase5a2-primitives-firefox','phase5a2-primitives-webkit']};
  for(const [,mode,args] of launches){
    assert.deepEqual([...args.matchAll(/--project=([^ ]+)/g)].map(match=>match[1]),expected[mode]);
    assert.match(args,/--reporter=html,list/);
    assert.doesNotMatch(args,/--grep|--last-failed|--no-deps|--workers|--shard/);
  }
  for(const id of ['public_safety_assert','auth_preflight','local_fixture_seed','local_desktop_audit','catalog_candidates','auth_safety_assert','local_fixture_teardown','local_supabase_stop'])
    assert.equal([...workflow.matchAll(new RegExp('id: '+id+'\\b','g'))].length,1,id);
  assert.match(workflow,/steps.local_desktop_audit.outcome == 'success'/);
  assert.match(workflow,/run: npm run --silent visual-safety:fixtures-teardown/);
  assert.match(workflow,/run: bash frontend\/e2e\/scripts\/local-supabase-ci.sh stop/);
});

test('combined projects retain separated output roots and isolated sign-out identity',()=>{
  assert.match(read('frontend/tests/quality/mobile.audit.spec.ts'),/cleanScreenshotDir\("mobile"\)/);
  assert.match(read('frontend/tests/quality/desktop.audit.spec.ts'),/cleanScreenshotDir\("desktop"\)/);
  assert.match(read('frontend/tests/quality/helpers/screenshot.ts'),/path.join\(BASE_DIR, viewport\)/);
  const config=read('frontend/playwright.config.ts');
  assert.match(config,/workers: process.env.CI \? 1 : undefined/);
  const privateProject=config.slice(config.indexOf('const privatePwaCacheProject'),config.indexOf('const privatePwaCacheProject')+1200);
  assert.match(privateProject,/authStatePath\("functional-user.json"\)/);
  assert.match(privateProject,/dependencies: \["auth-setup", "functional-auth-setup"\]/);
  const launcher=read('frontend/e2e/scripts/visual-safety-cli.mts');
  assert.match(launcher,/await cleanBuild\(contract/);
  assert.match(launcher,/await verifyBuildProvenance\(contract\)/);
  assert.match(launcher,/assertProxyClean\(proxy\)/);
});
