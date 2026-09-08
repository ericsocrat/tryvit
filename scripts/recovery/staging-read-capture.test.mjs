import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import path from 'node:path';
import {createRoleSql,cleanupRoleSql,drainRoleSql,drainOwnedRole,closeOwnedSession,managementSql,classifyDumpFailure,catalogDumpArgs,AUTHORITY_SQL,scramVerifier,ownedRole,withOwnedRole,readToken,repositoryEnvPath} from './staging-read-capture.mjs';
import {RecoveryError} from './catalog-recovery.mjs';
const role='tryvit_stage_capture_'+'a'.repeat(24),expires='2026-09-08T12:00:00.000Z';

test('credential discovery is repository-bound without personal workstation paths',()=>{
  const common=path.resolve('synthetic-repository/.git');
  for(const remote of ['https://github.com/ericsocrat/tryvit.git','git@github.com:ericsocrat/tryvit.git'])
    assert.equal(repositoryEnvPath(common,remote),path.resolve('synthetic-repository/.env'));
  assert.throws(()=>repositoryEnvPath(common,'https://github.com/other/project.git'));
  assert.throws(()=>repositoryEnvPath(path.resolve('not-git'),'https://github.com/ericsocrat/tryvit.git'));
  assert.equal(readToken(undefined,{SUPABASE_ACCESS_TOKEN:'sbp_synthetic123'}),'sbp_synthetic123');
  assert.throws(()=>readToken(undefined,{SUPABASE_ACCESS_TOKEN:'invalid-secret-canary'}),error=>!error.message.includes('invalid-secret-canary'));
});
test('role creation contains specific read grants and no plaintext password or broad memberships',()=>{
  const password='synthetic-test-only',sql=createRoleSql(role,scramVerifier(password,Buffer.alloc(16)),expires);
  assert.ok(!sql.includes(password));assert.match(sql,/default_transaction_read_only=on/u);
  assert.doesNotMatch(sql,/pg_read_all_data|GRANT postgres|GRANT ALL/u);
  assert.match(sql,/SELECT\(id\) ON public.product_change_log/u);
  for(const bad of ['postgres','cli_login_postgres','tryvit_stage_capture_;DROP ROLE postgres'])assert.throws(()=>ownedRole(bad));
});
test('cleanup checks exact role OID and sessions, and never cleans unrelated objects',()=>{
  const sql=cleanupRoleSql(role,'4321');assert.match(sql, /<>4321::oid/u);
  assert.match(sql,/capture_sessions_remain/u);assert.match(sql,/DROP ROLE "tryvit_stage_capture_/u);
  assert.doesNotMatch(sql,/DROP OWNED|CASCADE|cli_login/u);
});
test('capture failure still cleans exact owned role and verifies absence',async()=>{
  const calls=[];
  const sql=async text=>{calls.push(text);if(text.includes('current_user'))return [{actor:'postgres',exists:false}];
    if(text.startsWith('SELECT oid'))return [{oid:'4321'}];if(text.startsWith('SELECT EXISTS'))return [{exists:false}];
    if(text.startsWith('SELECT count'))return [{remaining:0}];return [];};
  await assert.rejects(withOwnedRole({role,verifier:scramVerifier('test'),expires,sql,capture:async()=>{throw Error('synthetic-capture-failure');}}),/synthetic-capture-failure/u);
  assert.ok(calls.some(c=>c.includes('DROP ROLE')));assert.ok(calls.at(-1).startsWith('SELECT EXISTS'));
});
test('pooler drain is exact-OID scoped, denies new logins, checks authority and waits for absence',async()=>{
  const sql=drainRoleSql(role,'4321');
  assert.match(sql,/usesysid=4321::oid AND pid<>pg_backend_pid\(\)/u);
  assert.match(sql,/pg_signal_backend/u);assert.match(sql,/admin_option/u);assert.match(sql,/NOLOGIN/u);
  assert.match(sql,/FOR owned_backend IN SELECT pid,backend_start/u);
  assert.match(sql,/backend_start=owned_backend.backend_start/u);
  assert.match(sql,/PERFORM pg_terminate_backend\(owned_backend.pid\);/u);
  assert.doesNotMatch(sql,/AND NOT pg_terminate_backend/u);
  let reads=0,waits=0;
  await drainOwnedRole(async query=>query.startsWith('SELECT count')?[{remaining:reads++===0?1:0}]:[],role,'4321',async()=>waits++);
  assert.equal(waits,1);
  await assert.rejects(drainOwnedRole(async()=>[{remaining:1}],role,'4321',async()=>{}),/capture_owned_backend_drain_timeout/u);
});
test('management errors identify phase/status without response bodies or credentials',async()=>{
  const error=await managementSql('synthetic-token','SELECT 1','cleanup_drop',async()=>({ok:false,status:503,
    text:async()=>{throw Error('response body must not be read');}})).catch(e=>e);
  assert.equal(error.code,'staging_cleanup_drop_http_503');
  assert.ok(!error.message.includes('synthetic-token'));
});
test('cleanup failure cannot replace original capture failure',async()=>{
  const primary=new RecoveryError('staging_schema_dump_failed');
  const sql=async(text,phase)=>{
    if(phase==='cleanup_drain')throw new RecoveryError('staging_cleanup_drain_http_503');
    if(text.includes('current_user'))return [{actor:'postgres',exists:false}];
    if(text.startsWith('SELECT oid'))return [{oid:'4321'}];return [];
  };
  const error=await withOwnedRole({role,verifier:scramVerifier('test'),expires,sql,capture:async()=>{throw primary;}}).catch(e=>e);
  assert.equal(error,primary);assert.equal(error.cleanupCode,'staging_cleanup_drain_http_503');
});
test('failed session rollback still kills and awaits only its owned child',async()=>{
  const child=new EventEmitter();child.exitCode=null;let killed=0;
  child.kill=()=>{killed++;queueMicrotask(()=>{child.exitCode=1;child.emit('exit');});};
  await assert.rejects(closeOwnedSession({child,close:async()=>{throw Error('rollback-failure');}}),/rollback-failure/u);
  assert.equal(killed,1);assert.equal(child.exitCode,1);
});
test('authority capture is structural and excludes role passwords and settings',()=>{
  assert.match(AUTHORITY_SQL,/rolbypassrls/u);assert.match(AUTHORITY_SQL,/datacl/u);
  assert.doesNotMatch(AUTHORITY_SQL,/rolpassword|rolconfig|auth\.users|pg_authid/u);
});
test('existing role collision is never changed or dropped',async()=>{
  const calls=[];
  await assert.rejects(withOwnedRole({role,verifier:scramVerifier('test'),expires,sql:async text=>{calls.push(text);return [{actor:'postgres',exists:true}];},capture:async()=>{throw Error('unreachable');}}));
  assert.equal(calls.length,1);
});
test('dump diagnostic exposes fixed categories only, never names or raw values',()=>{
  assert.equal(classifyDumpFailure('permission denied for table private_secret\nLOCK TABLE auth.private_secret IN ACCESS SHARE MODE','schema'),
    'staging_schema_dump_permission_includes_auth');
  assert.equal(classifyDumpFailure('permission denied for table products','catalog'),'staging_catalog_dump_permission_approved_catalog');
  assert.equal(classifyDumpFailure('permission denied for table hidden_identity','schema'),'staging_schema_dump_permission_unapproved_relation');
  assert.equal(classifyDumpFailure('ERROR very secret source fragment','schema'),'staging_schema_dump_native_unspecified');
});
test('schema and data archives select exactly the same fifteen public catalog tables',()=>{
  const schema=catalogDumpArgs(true),data=catalogDumpArgs(false);
  assert.equal(schema[0],'--schema-only');assert.equal(data[0],'--data-only');
  assert.deepEqual(schema.slice(1),data.slice(1));assert.equal(schema.filter(a=>a==='--table').length,15);
  assert.ok(schema.filter(a=>a.startsWith('public.')).every(a=>!a.includes('*')));
  assert.doesNotMatch(schema.join(' '),/auth\.|storage\.|user_|product_change_log|mv_refresh_log/u);
  assert.throws(()=>catalogDumpArgs('true'));
});
