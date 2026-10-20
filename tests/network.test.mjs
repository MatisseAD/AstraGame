import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

test('online create / join / ready / authoritative snapshot / reconnect / origin rejection', {timeout:30000}, async t=>{
 const port=34567;
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),ALLOWED_ORIGINS:'http://localhost:3000'},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill('SIGTERM'));
 let log='';
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Server startup timeout: '+log)),8000);
  child.stdout.on('data',d=>{log+=d;if(log.includes('listening')){clearTimeout(timer);resolve()}});
  child.stderr.on('data',d=>log+=d);child.on('exit',c=>{clearTimeout(timer);reject(new Error('Server exited '+c+': '+log))});
 });
 async function connect(){
  const ws=new WebSocket('ws://localhost:'+port+'/ws',{origin:'http://localhost:3000'});
  t.after(()=>ws.terminate());
  const queue=[];
  ws.on('message',raw=>queue.push(JSON.parse(raw)));
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject)});
  return {
   ws,send:data=>ws.send(JSON.stringify(data)),
   wait:predicate=>new Promise((resolve,reject)=>{
    const until=Date.now()+5000;
    const poll=setInterval(()=>{const i=queue.findIndex(predicate);if(i!==-1){clearInterval(poll);resolve(queue.splice(i,1)[0])}else if(Date.now()>until){clearInterval(poll);reject(new Error('Message timeout'))}},10);
   })
  };
 }
 const a=await connect();a.send({type:'create',protocol:1,name:'Alice'});
 const welcome=await a.wait(m=>m.type==='welcome');
 assert.match(welcome.code,/^[A-F0-9]{10}$/);assert.equal(welcome.token.length,64);
 const b=await connect();b.send({type:'join',protocol:1,name:'Bob',code:welcome.code});
 const second=await b.wait(m=>m.type==='welcome');assert.notEqual(second.id,welcome.id);
 a.send({type:'action',action:{type:'ready'}});
 b.send({type:'action',action:{type:'ready'}});
 const state=await a.wait(m=>m.type==='state'&&m.state.phase==='playing');
 assert.equal(state.state.players.length,2);
 assert.ok(!JSON.stringify(state).includes(welcome.token));
 const p=state.state.players.find(p=>p.id===welcome.id);
 a.send({type:'action',action:{type:'input',x:999,y:0,angle:0}});
 const moved=await a.wait(m=>m.type==='state'&&m.state.players.find(p=>p.id===welcome.id).x>p.x);
 assert.ok(moved.state.players.find(p=>p.id===welcome.id).x-p.x<80);
 // Invalid object keys must not crash the simulation process.
 a.send({type:'action',action:{type:'build',kind:{toString:null},x:500,y:1000}});
 const invalid=await a.wait(m=>m.type==='error');assert.ok(invalid.message);
 a.ws.close();
 const resumed=await connect();resumed.send({type:'resume',protocol:1,code:welcome.code,token:welcome.token});
 const restored=await resumed.wait(m=>m.type==='welcome');assert.equal(restored.id,welcome.id);
 const third=await connect();third.send({type:'join',protocol:1,name:'Third',code:welcome.code});
 assert.match((await third.wait(m=>m.type==='error')).message,/complet|commencé/);
 const rejected=new WebSocket('ws://localhost:'+port+'/ws',{origin:'https://untrusted.invalid'});
 await new Promise((resolve,reject)=>{rejected.once('error',resolve);rejected.once('open',()=>{rejected.terminate();reject(new Error('Unexpected origin accepted'))})});
});
