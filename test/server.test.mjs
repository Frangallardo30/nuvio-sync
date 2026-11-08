import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'nuvio-test-'));
process.env.DATA_DIR=dir;process.env.OWNER_EMAIL='owner@example.com';
const originalFetch=global.fetch;
const upstream=[];
global.fetch=async (url,options)=>{
  if(String(url).startsWith('https://api.nuvio.tv')) {
    upstream.push({url,options});
    if(String(url).endsWith('/auth/v1/user'))return Response.json({email:options.headers.Authorization==='Bearer owner'?'owner@example.com':'friend@example.com'});
    return Response.json([]);
  }
  return originalFetch(url,options);
};
const {server}=await import('../server.mjs');
let base;
before(async()=>{server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));global.fetch=originalFetch;await rm(dir,{recursive:true,force:true});});
const post=(path,body,token,extra={})=>originalFetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...extra},body:JSON.stringify(body)});
test('sirve app y recursos sin exponer archivos internos',async()=>{
  for(const path of ['/','/app.js','/style.css'])assert.equal((await originalFetch(base+path)).status,200);
  assert.equal((await originalFetch(base+'/.env')).status,404);
  assert.equal((await originalFetch(base+'/server.mjs')).status,404);
});
test('rechaza solicitudes de otro origen y operaciones sin token',async()=>{
  assert.equal((await post('/api/nuvio/profiles',{},null)).status,401);
  assert.equal((await post('/api/nuvio/profiles',{},'token',{Origin:'https://evil.test'})).status,403);
});
test('solo acepta acciones fijas y perfiles enteros',async()=>{
  assert.equal((await post('/api/nuvio/delete-account',{},'token')).status,404);
  assert.equal((await post('/api/nuvio/addons',{profile:'0&select=secrets'},'token')).status,400);
  const r=await post('/api/nuvio/addons',{profile:0},'token');assert.equal(r.status,200);
  assert.match(upstream.at(-1).url,/profile_id=eq.0&order=sort_order$/);
});
test('solo el propietario puede guardar y no se almacenan sesiones',async()=>{
  const body={name:'Plantilla',reviewed:true,config:{addons:[{url:'https://addon.test/manifest.json',name:'Addon',user_id:'origin',profile_id:9}],plugins:[],collections:[]}};
  assert.equal((await post('/api/template',body,'friend')).status,403);
  assert.equal((await post('/api/template',{...body,reviewed:false},'owner')).status,400);
  assert.equal((await post('/api/template',body,'owner')).status,200);
  const stored=await readFile(join(dir,'template.json'),'utf8');assert.ok(!stored.includes('Bearer'));assert.ok(!stored.includes('user_id'));
  const saved=await (await originalFetch(base+'/api/template')).json();assert.equal(saved.config.addons.length,1);
});
