import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import test from 'node:test';
import {assertContained,containmentArgs,decryptBytes,encryptBytes} from './opaque-containment.mjs';

test('container command has no ports, host mounts or production credentials',()=>{
  const args=containmentArgs('tryvit_recovery_probe_012345abcdef',{database:true});
  assert.equal(args[args.indexOf('--network')+1],'none');
  assert.ok(args.includes('--read-only'));assert.ok(args.includes('--cap-drop'));
  assert.equal(args[args.indexOf('--log-driver')+1],'none');
  assert.ok(!args.some(x=>['--publish','-p','-v','--volume','--env'].includes(x)));
  assert.match(args.at(-1),/cron.launch_active_jobs=off/);
  assert.throws(()=>containmentArgs('supabase_db_tryvit-evidence-first'));
});
test('encryption is randomized, authenticated and rejects wrong keys',()=>{
  const key=randomBytes(32),plain=Buffer.from('synthetic test only');
  const sealed=encryptBytes(plain,key),second=encryptBytes(plain,key);
  assert.ok(!sealed.equals(second));assert.deepEqual(decryptBytes(sealed,key),plain);
  assert.throws(()=>decryptBytes(sealed,randomBytes(32)));
  const tampered=Buffer.from(sealed);tampered[22]^=1;assert.throws(()=>decryptBytes(tampered,key));
});
test('inspection rejects weakened containment',()=>{
  const good={Config:{Labels:{'tryvit.recovery.scope':'containment-probe'}},Mounts:[],HostConfig:{
    NetworkMode:'none',ReadonlyRootfs:true,PortBindings:{},Binds:[],LogConfig:{Type:'none'},
    CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],Memory:1024,MemorySwap:1024}};
  assert.doesNotThrow(()=>assertContained(good));
  for(const patch of [{NetworkMode:'bridge'},{ReadonlyRootfs:false},{Privileged:true},{PidMode:'host'},
    {IpcMode:'host'},{PublishAllPorts:true},{PortBindings:{'5432/tcp':[{}]}},
    {Binds:['/host:/host']},{LogConfig:{Type:'json-file'}},{MemorySwap:4096}])
    assert.throws(()=>assertContained({...good,HostConfig:{...good.HostConfig,...patch}}));
});
