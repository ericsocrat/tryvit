import test from 'node:test';
import assert from 'node:assert/strict';
import {SqlSession} from './catalog-recovery.mjs';
import {containmentArgs} from './opaque-containment.mjs';
const childEnv={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR};

test('full-cohort deadline is bounded and all containment defaults remain identical',()=>{
  const name='tryvit_recovery_probe_0123456789ab';
  const original=containmentArgs(name,{database:true});
  const extended=containmentArgs(name,{database:true,lifetimeSeconds:1200});
  assert.deepEqual(original.slice(0,-1),extended.slice(0,-1));
  assert.equal(extended.at(-1),original.at(-1).replace('timeout 300 postgres','timeout 1200 postgres'));
  for(const lifetimeSeconds of [0,301,1201,Infinity,'1200'])assert.throws(()=>containmentArgs(name,{database:true,lifetimeSeconds}));
  assert.throws(()=>containmentArgs(name,{lifetimeSeconds:1200}));
});

test('stdin failure rejects pending COMMIT and later requests without retry or raw errors',async()=>{
  const session=new SqlSession(process.execPath,['-e','process.stdin.resume()'],childEnv);
  try {
    const request=session.query('COMMIT');
    const rejected=assert.rejects(request,error=>error.code==='sql_session_stdin_failed'&&!error.message.includes('private'));
    session.child.stdin.emit('error',new Error('EPIPE private details must not escape'));
    await rejected;
    assert.equal(session.pending,null);
    await assert.rejects(session.query('COMMIT'),error=>error.code==='sql_session_stdin_failed');
  } finally {await session.close();}
});

test('exited SQL transport rejects new work instead of writing into a dead pipe',async()=>{
  const session=new SqlSession(process.execPath,['-e','process.exit(0)'],childEnv);
  await new Promise(resolve=>session.child.once('exit',resolve));
  await assert.rejects(session.query('SELECT 1'),error=>error.code.startsWith('sql_session_failed_'));
  await session.close();
});
