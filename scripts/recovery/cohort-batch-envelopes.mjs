/** Reuses the private directory and authenticated encryption boundary. */
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {ROOT,fail} from './cohort-batch.mjs';
import {privateDirectory} from './catalog-recovery.mjs';
import {dpapi,encryptBytes,decryptBytes} from './opaque-containment.mjs';
import {hash} from '../ci/database-release.mjs';
const write=(file,bytes)=>{const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
export function batchEnvelopeStore(entry,manifestSha256,{environment='isolated-clone'}={}) {
  // No production orchestrator is exposed until fresh recovery integration is reviewed.
  if(environment!=='isolated-clone')fail('cohort_production_transport_not_implemented');
  fs.mkdirSync(path.join(ROOT,'backups'),{recursive:true,mode:0o700});
  const directory=path.join(ROOT,'backups',`cohort_batch_clone_${entry.productId}_${Date.now()}_${randomBytes(4).toString('hex')}`);
  privateDirectory(directory);const key=randomBytes(32);write(path.join(directory,'key.dpapi'),dpapi('protect',key));
  return {directory,save(stage,value){
    if(!['before','after','reversal'].includes(stage))fail('cohort_invalid_envelope_stage');
    const plain=Buffer.from(JSON.stringify({environment,manifestSha256,...value})),bytes=encryptBytes(plain,key);
    try {write(path.join(directory,stage+'.enc'),bytes);if(!decryptBytes(fs.readFileSync(path.join(directory,stage+'.enc')),key).equals(plain))fail('cohort_envelope_disk_mismatch');}
    finally {plain.fill(0);}
    return hash(bytes);
  },close(){key.fill(0);}};
}
export function readBatchEnvelope(directory,stage) {
  const resolved=path.resolve(directory);
  if(!resolved.startsWith(path.join(ROOT,'backups','cohort_batch_clone_'))||fs.realpathSync(resolved)!==resolved||!['before','after','reversal'].includes(stage))
    fail('cohort_invalid_private_envelope_path');
  const key=dpapi('unprotect',fs.readFileSync(path.join(resolved,'key.dpapi')));
  try {
    const envelope=JSON.parse(decryptBytes(fs.readFileSync(path.join(resolved,stage+'.enc')),key));
    if(envelope.environment!=='isolated-clone')fail('cohort_envelope_environment_mismatch');return envelope;
  } finally {key.fill(0);}
}
