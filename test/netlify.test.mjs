import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../netlify-handler.mjs';
import {config as apiConfig} from '../netlify/functions/api.mjs';
import {config as loginConfig} from '../netlify/functions/login.mjs';
const original=global.fetch;const calls=[];let saved=null;
global.fetch=async(url,options)=>{
  calls.push({url,options});
  if(String(url).endsWith('/auth/v1/user'))return Response.json({email:options.headers.Authorization==='Bearer owner'?'owner@example.com':'friend@example.com'});
  if(String(url).includes('/auth/v1/token'))return Response.json({access_token:'temporary',refresh_token:'must-not-return',user:{id:'123',email:'friend@example.com'}});
  return Response.json([]);
};
after(()=>{global.fetch=original;});
const deps={ownerEmail:'owner@example.com',getStore:()=>({get:async()=>saved,setJSON:async(key,value)=>{assert.equal(key,'shared-template');saved=value;}})};
const req=(path,body,token,headers={})=>new Request('https://example.netlify.app'+path,body===undefined?undefined:{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`} : {}),...headers},body:JSON.stringify(body)});
test('Netlify sirve y persiste plantilla con autorización del propietario',async()=>{
  assert.equal(await(await handleApi(req('/api/template'),deps)).json(),null);
  const body={name:'Mi plantilla',reviewed:true,config:{addons:[],plugins:[],collections:[]}};
  assert.equal((await handleApi(req('/api/template',body,'friend'),deps)).status,403);assert.equal(saved,null);
  assert.equal((await handleApi(req('/api/template',body,'owner'),deps)).status,200);
  assert.equal((await(await handleApi(req('/api/template'),deps)).json()).name,'Mi plantilla');
});
test('guardado falla explícitamente si falta OWNER_EMAIL o almacenamiento',async()=>{
  assert.equal((await handleApi(req('/api/template',{},'owner'),{...deps,ownerEmail:undefined})).status,503);
  const result=await handleApi(req('/api/template'),{...deps,getStore:()=>{throw new Error('storage failed');}});
  assert.equal(result.status,400);assert.ok((await result.json()).error);
});
test('bloquea otro origen, JSON inválido, cuerpos grandes y rutas arbitrarias',async()=>{
  assert.equal((await handleApi(req('/api/nuvio/profiles',{},'owner',{origin:'https://other.test'}),deps)).status,403);
  assert.equal((await handleApi(req('/api/nuvio/arbitrary',{},'owner'),deps)).status,404);
  assert.equal((await handleApi(req('/api/nuvio/addons',{profile:'0&select=secret'},'owner'),deps)).status,400);
  assert.equal((await handleApi(req('/api/nuvio/profiles',{x:'a'.repeat(2_000_001)},'owner'),deps)).status,413);
  assert.equal((await handleApi(new Request('https://example.netlify.app/api/template',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer owner'},body:'not json'}),deps)).status,400);
});
test('login devuelve solo sesión mínima y no necesita almacenamiento',async()=>{
  const response=await handleApi(req('/api/nuvio/login',{email:'friend@example.com',password:'test-only'}),{getStore:()=>{throw new Error('should not open storage');}});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.access_token,'temporary');assert.equal(body.refresh_token,undefined);
  assert.equal(response.headers.get('cache-control'),'no-store');
});
test('rutas de Netlify aíslan login con límite nativo por IP',()=>{
  assert.ok(!apiConfig.path.includes('/api/nuvio/login'));assert.equal(loginConfig.path,'/api/nuvio/login');
  assert.equal(loginConfig.rateLimit.windowLimit,12);assert.equal(loginConfig.rateLimit.aggregateBy,'ip');
});
test('escritura de addons conserva el contrato de Nuvio y token del destino',async()=>{
  const payload={p_profile_id:1,p_addons:[{url:'https://addon.test/manifest.json',name:'test',enabled:true,sort_order:0}]};
  const response=await handleApi(req('/api/nuvio/pushAddons',payload,'target'),deps);
  assert.equal(response.status,200);assert.ok(calls.at(-1).url.endsWith('/rpc/sync_push_addons'));
  assert.equal(calls.at(-1).options.headers.Authorization,'Bearer target');assert.deepEqual(JSON.parse(calls.at(-1).options.body),payload);
});
