/** Real PostgreSQL regression in a fresh network-none, no-host-mount container. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import test from 'node:test';
import {SqlSession} from './catalog-recovery.mjs';
import {containmentArgs,assertContained} from './opaque-containment.mjs';
import {drainOwnedRole,closeOwnedSession,NORMALIZED_GRANTS_SQL,classifyDumpFailure} from './staging-read-capture.mjs';

test('real PostgreSQL drain terminates only owned role and unrelated connection survives',{timeout:60000},async()=>{
  const name='tryvit_recovery_probe_'+randomBytes(6).toString('hex');
  const role='tryvit_stage_capture_'+randomBytes(12).toString('hex');
  const run=args=>{const result=spawnSync('docker',args,{encoding:'utf8',timeout:10000,windowsHide:true});
    assert.equal(result.status,0,'isolated synthetic docker command failed: '+result.stderr.slice(0,500));return result.stdout.trim();};
  let created=false,owned,unrelated;
  try {
    run(containmentArgs(name,{database:true,bootstrapUser:'tryvit_recovery_operator'}));created=true;
    let ready=false;
    for(let i=0;i<25;i++){
      if(spawnSync('docker',['exec',name,'pg_isready','-h','/tmp','-U','tryvit_recovery_operator'],{stdio:'ignore',windowsHide:true}).status===0){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    assert.ok(ready);assertContained(JSON.parse(run(['inspect',name]))[0]);
    const query=(sql,user='postgres')=>run(['exec',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/tmp','-U',user,'-d','postgres','-c',sql]);
    query('CREATE ROLE postgres LOGIN NOSUPERUSER CREATEROLE BYPASSRLS; GRANT pg_signal_backend,pg_monitor TO postgres;', 'tryvit_recovery_operator');
    assert.equal(query("SELECT rolsuper||'|'||rolcreaterole||'|'||rolbypassrls FROM pg_roles WHERE rolname=current_user;"),'false|true|true');
    query(`CREATE ROLE "${role}" LOGIN;`);
    query('CREATE TABLE public.capture_acl_fixture(id integer GENERATED ALWAYS AS IDENTITY); ALTER TABLE public.capture_acl_fixture OWNER TO postgres;', 'tryvit_recovery_operator');
    const originalGrants=query(NORMALIZED_GRANTS_SQL);
    query(`GRANT SELECT(id) ON public.capture_acl_fixture TO "${role}"; REVOKE SELECT(id) ON public.capture_acl_fixture FROM "${role}";`);
    query(`GRANT CONNECT ON DATABASE postgres TO "${role}"; REVOKE CONNECT ON DATABASE postgres FROM "${role}";`, 'tryvit_recovery_operator');
    assert.equal(query(NORMALIZED_GRANTS_SQL),originalGrants,'semantic ACL defaults and column-grant cleanup match');
    query('CREATE SCHEMA auth; CREATE TABLE auth.private_identity(id integer);', 'tryvit_recovery_operator');
    query(`GRANT SELECT ON public.capture_acl_fixture TO "${role}";`);
    const dump=extra=>spawnSync('docker',['exec',name,'pg_dump','-h','/tmp','-U',role,'-d','postgres','--schema-only',...extra],
      {encoding:'utf8',windowsHide:true,timeout:10000});
    const denied=dump([]);
    assert.notEqual(denied.status,0,'full schema cannot silently bypass private-table lock permissions');
    assert.match(classifyDumpFailure(denied.stderr,'schema'),/^staging_schema_dump_permission_/u);
    const bounded=dump(['--table=public.capture_acl_fixture']);
    assert.equal(bounded.status,0,'selected-table schema works without private SELECT');
    assert.ok(!bounded.stdout.includes('CREATE TABLE auth.private_identity'));
    const dataDump=()=>spawnSync('docker',['exec',name,'pg_dump','-h','/tmp','-U',role,'-d','postgres','--data-only','--table=public.capture_acl_fixture'],
      {encoding:'utf8',windowsHide:true,timeout:10000});
    assert.notEqual(dataDump().status,0,'catalog data capture also needs its owned sequence state');
    query(`GRANT SELECT ON public.capture_acl_fixture_id_seq TO "${role}";`);
    assert.equal(dataDump().status,0,'explicit owned-sequence SELECT completes bounded data capture');
    query(`REVOKE SELECT ON public.capture_acl_fixture_id_seq FROM "${role}";`);
    query(`REVOKE SELECT ON public.capture_acl_fixture FROM "${role}";`);
    const oid=query(`SELECT oid FROM pg_roles WHERE rolname='${role}';`);
    const connect=user=>new SqlSession('docker',['exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/tmp','-U',user,'-d','postgres'],process.env);
    unrelated=connect('postgres');const unrelatedPid=await unrelated.query('SELECT pg_backend_pid()');
    owned=connect(role);const ownedPid=await owned.query('SELECT pg_backend_pid()');
    assert.notEqual(ownedPid,unrelatedPid);
    await drainOwnedRole(async sql=>{
      const raw=query(sql);return sql.startsWith('SELECT count')?[{remaining:Number(raw)}]:[];
    },role,oid);
    assert.equal(await unrelated.query('SELECT pg_backend_pid()'),unrelatedPid);
    assert.equal(await unrelated.query('SELECT 42'),'42');
    assert.equal(query(`SELECT count(*) FROM pg_stat_activity WHERE usesysid=${oid}::oid;`),'0');
    assert.equal(query(`SELECT rolcanlogin FROM pg_roles WHERE oid=${oid}::oid;`),'f');
    query(`DROP ROLE "${role}";`);
  } finally {
    for(const session of [owned,unrelated])if(session)try {await closeOwnedSession(session);}catch{session.child.kill();}
    if(created){assertContained(JSON.parse(run(['inspect',name]))[0]);run(['rm','--force',name]);}
  }
});
