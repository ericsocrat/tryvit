/** Containment and encryption primitives only. Does NOT export production. */
import {spawnSync} from 'node:child_process';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
// Match the production pg_graphql1.5.11 dependency. Later image1.165 bundles
// only1.6.1 and cannot reconstruct the extension-owned source wrapper.
export const IMAGE='public.ecr.aws/supabase/postgres:17.6.1.075';
export function containmentArgs(name,{database=false,bootstrapUser='postgres',locale='C.UTF-8',lifetimeSeconds=300}={}) {
  if(!/^tryvit_recovery_probe_[a-f0-9]{12}$/.test(name)) throw new Error('UNSAFE_CONTAINER_NAME');
  if(!['postgres','tryvit_recovery_operator'].includes(bootstrapUser)||!['C.UTF-8','en_US.UTF-8'].includes(locale))
    throw new Error('UNSAFE_BOOTSTRAP_SETTING');
  if(![300,1200].includes(lifetimeSeconds)||(!database&&lifetimeSeconds!==300))throw new Error('UNSAFE_CONTAINMENT_LIFETIME');
  const script=database ?
    `initdb -D /var/lib/postgresql/data --locale=${locale} --encoding=UTF8 -A trust -U ${bootstrapUser} >/dev/null 2>&1 && exec timeout ${lifetimeSeconds} postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp -c shared_preload_libraries=pg_cron,pg_stat_statements -c cron.launch_active_jobs=off -c log_min_messages=panic -c log_min_error_statement=panic -c logging_collector=off -c log_statement=none -c jit=off` : 'sleep 300';
  return ['run','--detach','--name',name,'--label','tryvit.recovery.scope=containment-probe',
    '--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
    '--user','100:101','--cpus','1','--memory','1g','--memory-swap','1g','--pids-limit','128',
    '--log-driver','none','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=64m,uid=100,gid=101',
    '--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=768m,uid=100,gid=101',
    '--entrypoint','/bin/sh',IMAGE,'-c',script];
}
export function assertContained(item) {
  const h=item.HostConfig;
  if(item.Config.Labels['tryvit.recovery.scope']!=='containment-probe'||h.NetworkMode!=='none'||
    !h.ReadonlyRootfs||h.Privileged||h.PublishAllPorts||h.PidMode==='host'||h.IpcMode==='host'||
    Object.keys(h.PortBindings||{}).length||h.Binds?.length||h.Devices?.length||
    item.Mounts.some(m=>m.Type!=='tmpfs')||h.LogConfig.Type!=='none'||
    !h.CapDrop?.includes('ALL')||!h.SecurityOpt?.some(x=>x.startsWith('no-new-privileges'))||
    h.Memory!==h.MemorySwap||!h.Memory||h.Memory>1024*1024*1024)
    throw new Error('CONTAINMENT_VERIFICATION_FAILED');
}
function run(args,options={}) {
  const result=spawnSync('docker',args,{encoding:'utf8',maxBuffer:1024*1024,...options});
  if(result.status!==0) throw new Error('CONTAINMENT_COMMAND_FAILED');
  return result.stdout.trim();
}
export function dpapi(mode,input) {
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(HERE,'dpapi-key.ps1'),'-Mode',mode],
    {input:input.toString('base64'),encoding:'utf8',maxBuffer:1024*1024});
  if(result.status!==0) throw new Error('DPAPI_FAILED');
  return Buffer.from(result.stdout.trim(),'base64');
}
export function encryptBytes(plain,key,iv=randomBytes(12)) {
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const body=Buffer.concat([cipher.update(plain),cipher.final()]);
  return Buffer.concat([Buffer.from('TVREC001'),iv,body,cipher.getAuthTag()]);
}
export function decryptBytes(sealed,key) {
  if(sealed.length<36||sealed.subarray(0,8).toString()!=='TVREC001') throw new Error('ARCHIVE_HEADER_INVALID');
  const decipher=createDecipheriv('aes-256-gcm',key,sealed.subarray(8,20));
  decipher.setAuthTag(sealed.subarray(-16));
  return Buffer.concat([decipher.update(sealed.subarray(20,-16)),decipher.final()]);
}
export async function probe() {
  const name='tryvit_recovery_probe_'+randomBytes(6).toString('hex');
  const checks={};let created=false;
  try {
    run(containmentArgs(name,{database:true}));created=true;
    let ready=false;
    for(let attempt=0;attempt<30;attempt++) {
      const result=spawnSync('docker',['exec',name,'pg_isready','-h','/tmp','-U','postgres'],{encoding:'utf8'});
      if(result.status===0){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(!ready) throw new Error('ISOLATED_POSTGRES_NOT_READY');
    assertContained(JSON.parse(run(['inspect',name]))[0]);checks.containerIsolation=true;
    checks.cronDisabled=run(['exec',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-qAt','-c',
      "select current_setting('cron.launch_active_jobs'),current_setting('listen_addresses'),current_setting('log_min_messages')"])
      ==='off||panic';
    checks.noDockerSocket=spawnSync('docker',['exec',name,'test','!','-S','/var/run/docker.sock']).status===0;
    checks.rootWriteBlocked=spawnSync('docker',['exec',name,'touch','/outside-tmpfs'],{stdio:'ignore'}).status!==0;
    checks.onlyLoopbackInterface=run(['exec',name,'sh','-c','ls /sys/class/net'])==='lo';
    checks.egressBlocked=spawnSync('docker',['exec',name,'bash','-c','timeout 2 bash -c "echo >/dev/tcp/1.1.1.1/443"'],{stdio:'ignore'}).status!==0;
    const key=randomBytes(32),plain=Buffer.from('synthetic opaque recovery canary - not customer data');
    const wrapped=dpapi('protect',key),unwrapped=dpapi('unprotect',wrapped);
    const sealed=encryptBytes(plain,key);
    checks.userBoundKeyRoundtrip=key.equals(unwrapped);
    checks.authenticatedEncryption=decryptBytes(sealed,unwrapped).equals(plain);
    const tampered=Buffer.from(sealed);tampered[24]^=1;
    try{decryptBytes(tampered,key);checks.tamperRejected=false;}catch{checks.tamperRejected=true;}
    checks.noPlaintextInCiphertext=!sealed.includes(plain);
    key.fill(0);unwrapped.fill(0);plain.fill(0);
  } finally {
    if(created) {
      const item=JSON.parse(run(['inspect',name]))[0];
      if(item.Config.Labels['tryvit.recovery.scope']!=='containment-probe') throw new Error('CLEANUP_OWNERSHIP_MISMATCH');
      run(['rm','--force',name]);
      checks.containerRemoved=spawnSync('docker',['inspect',name],{stdio:'ignore'}).status!==0;
    }
  }
  const receipt={schemaVersion:1,mode:'synthetic-containment-probe',productionRowsRead:0,
    checkedAt:new Date().toISOString(),image:IMAGE,checks,result:Object.values(checks).every(Boolean)?'PASS':'FAIL'};
  fs.mkdirSync(path.join(ROOT,'audit-reports/recovery'),{recursive:true});
  fs.writeFileSync(path.join(ROOT,'audit-reports/recovery/containment-probe.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!process.argv.includes('--probe')) {console.log(JSON.stringify({mode:'primitives-only',productionExported:false}));}
  else probe().then(value=>console.log(JSON.stringify(value))).catch(()=>{console.error('OPAQUE_CONTAINMENT_HOLD');process.exitCode=1;});
}
