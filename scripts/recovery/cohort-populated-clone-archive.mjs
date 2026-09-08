/** Actual populated21 archive round-trip confined to an already verified clone. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {ROOT,fail,equal} from './cohort-batch.mjs';
import {scopeTables,fingerprintQuery,filterToc,privateDirectory} from './catalog-recovery.mjs';
import {assertContained,dpapi,encryptBytes,decryptBytes} from './opaque-containment.mjs';
import {hash} from '../ci/database-release.mjs';
function opaque(args,input) {
  const result=spawnSync('docker',args,{input,encoding:null,maxBuffer:64*1024*1024});
  if(result.status!==0)fail('populated_clone_archive_native_failure');return result.stdout;
}
const write=(file,bytes)=>{const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}};
export async function populatedCloneArchive(name,session,adapter) {
  assertContained(JSON.parse(opaque(['inspect',name]).toString())[0]);
  if(!/^tryvit_recovery_probe_[a-f0-9]{12}$/.test(name)||adapter.proof.productionRecoveryCertified!==false||adapter.proof.profile!=='observations-public-cohort-v1')
    fail('populated_clone_archive_scope_invalid');
  const before={};for(const table of scopeTables('observations-v1'))before[table]=JSON.parse(await session.query(fingerprintQuery(table,'observations-v1')));
  const privateReviewers=Number(await session.query('SELECT count(*) FROM public.products WHERE product_name_en_reviewed_by IS NOT NULL'));
  if(privateReviewers!==0)fail('populated_clone_private_reviewer_found');
  const external=JSON.parse(await session.query(`SELECT COALESCE(jsonb_agg(c.conname),'[]'::jsonb) FROM pg_constraint c
    JOIN pg_class p ON p.oid=c.conrelid JOIN pg_namespace n ON n.oid=p.relnamespace
    JOIN pg_class f ON f.oid=c.confrelid JOIN pg_namespace fn ON fn.oid=f.relnamespace
    WHERE n.nspname='public' AND p.relname='products' AND fn.nspname='auth' AND f.relname='users'`));
  const args=adapter.args.filter(a=>!a.startsWith('--file='));
  let plain=opaque(['exec',name,'pg_dump','-h','/tmp','-U','postgres','-d','postgres',...args]);
  const directory=path.join(ROOT,'backups','populated21_clone_'+Date.now()+'_'+randomBytes(4).toString('hex'));
  privateDirectory(directory);const key=randomBytes(32);
  try {
    const originalHash=hash(plain);write(path.join(directory,'archive.key.dpapi'),dpapi('protect',key));
    const sealed=encryptBytes(plain,key);write(path.join(directory,'catalog.dump.enc'),sealed);plain.fill(0);
    const reopenedKey=dpapi('unprotect',fs.readFileSync(path.join(directory,'archive.key.dpapi')));
    try{plain=decryptBytes(fs.readFileSync(path.join(directory,'catalog.dump.enc')),reopenedKey);}finally{reopenedKey.fill(0);}
    if(hash(plain)!==originalHash)fail('populated_clone_archive_bytes_changed');
    const toc=opaque(['exec','-i',name,'pg_restore','--list'],plain).toString('utf8');
    const list=filterToc(toc,external);
    opaque(['exec','-i',name,'dd','of=/tmp/populated21-restore.list','status=none'],Buffer.from(list));
    opaque(['exec',name,'psql','-h','/tmp','-U','tryvit_recovery_operator','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-c',
      'CREATE DATABASE cohort_populated_restore TEMPLATE template0']);
    opaque(['exec','-i',name,'pg_restore','-h','/tmp','-U','tryvit_recovery_operator','-d','cohort_populated_restore',
      '--no-owner','--no-privileges','--exit-on-error','--single-transaction','--use-list=/tmp/populated21-restore.list'],plain);
    const after={};for(const table of scopeTables('observations-v1'))after[table]=JSON.parse(opaque(['exec',name,'psql','-h','/tmp','-U','tryvit_recovery_operator',
      '-d','cohort_populated_restore','-X','-qAt','-v','ON_ERROR_STOP=1','-c',fingerprintQuery(table,'observations-v1')]).toString());
    if(!equal(before,after))fail('populated_clone_restored_rows_changed');
    return {result:'PASS',method:'clone-only-encrypted-populated21-data-archive-restore',tableCount:21,
      sourceFingerprintSha256:hash(Buffer.from(JSON.stringify(before))),restoredFingerprintSha256:hash(Buffer.from(JSON.stringify(after))),
      encryptedArchiveSha256:hash(sealed),plainArchiveSha256:originalHash,archiveBytesAuthenticated:true,allRowsExact:true,
      archiveDirectory:path.relative(ROOT,directory),productionRecoveryCertified:false,
      exclusions:['auth-foreign-key','RLS','triggers','RPC-restoration','storage-objects']};
  } finally {key.fill(0);plain.fill(0);}
}
