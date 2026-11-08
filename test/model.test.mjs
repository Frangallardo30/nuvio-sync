import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeConfig,validateConfig} from '../model.mjs';
import {addonIdentity} from '../model.mjs';
const addon=(url,name)=>({url,name,enabled:true,sort_order:0});
const config=(addons=[],plugins=[],collections=[])=>({addons,plugins,collections});
test('identidad distingue servicios del mismo dominio y reconoce ajustes en query',()=>{
  assert.notEqual(addonIdentity({url:'https://host.test/service-a/manifest.json'},'addons'),addonIdentity({url:'https://host.test/service-b/manifest.json'},'addons'));
  assert.equal(addonIdentity({url:'https://host.test/manifest.json?language=en'},'addons'),addonIdentity({url:'https://host.test/manifest.json?language=es'},'addons'));
  assert.notEqual(addonIdentity({url:'https://torrentio.strem.fun.evil.test/manifest.json'},'addons'),addonIdentity({url:'https://torrentio.strem.fun/manifest.json'},'addons'));
});
test('coincidencias reciben configuración de origen sin modificar otros complementos',()=>{
  const target=config([addon('https://a.test/manifest.json','anterior'),addon('https://b.test/manifest.json','conservar')]);
  const source=config([addon('https://a.test/manifest.json','actualizado'),addon('https://c.test/manifest.json','nuevo')]);
  const result=mergeConfig(target,source,['addons'],'merge');
  assert.deepEqual(result.addons.map(x=>x.name),['actualizado','conservar','nuevo']);
  assert.deepEqual(result.addons.map(x=>x.sort_order),[0,0,1]);
  assert.equal(target.addons[0].name,'anterior');
});
test('una fuente vacía no elimina elementos del destino',()=>{
  const target=config([addon('https://a.test','a')],[],[{id:'one',name:'guardar'}]);
  const result=mergeConfig(target,config(),['addons'],'replace');
  assert.equal(result.addons.length,1);assert.equal(result.collections[0].name,'guardar');
});
test('colecciones se combinan por ID y conservan referencias anidadas',()=>{
  const result=mergeConfig(config([],[],[{id:'1',name:'old'},{id:'2',name:'keep'}]),config([],[],[{id:'1',name:'new',folders:[{source:{url:'https://catalog.test'}}]}]),['collections'],'merge');
  assert.equal(result.collections.length,2);assert.equal(result.collections[0].name,'old');
});
test('no copia identificadores del usuario o perfil de origen',()=>{
  const result=validateConfig(config([{...addon('https://a.test','a'),id:'row',user_id:'secret',profile_id:3}],[],[{id:'c',user_id:'source',profile_id:2}]));
  assert.equal(result.addons[0].user_id,undefined);assert.equal(result.addons[0].id,undefined);assert.equal(result.collections[0].profile_id,undefined);
});
test('rechaza protocolos ejecutables y copias mal formadas',()=>{
  assert.throws(()=>validateConfig(config([addon('javascript:alert(1)','bad')])));
  assert.throws(()=>validateConfig({addons:[]}));assert.throws(()=>validateConfig(config([],[],[{name:'missing id'}])));
});
