import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shareableConfig,resolvePersonal} from '../public/providers.mjs';
import {validateConfig,mergeConfig} from '../model.mjs';
const config=addons=>({addons,plugins:[],collections:[]});
test('plantilla Nuve no conserva URL, token ni referencias personales de colecciones',()=>{
  const url='https://api.nuvehub.app/user-secret/manifest.json';
  const source={...config([{name:'Nuve+',url}]),collections:[{id:'private',folders:[{url}]},{id:'public',name:'Public'}]};
  const safe=shareableConfig(validateConfig(source));
  assert.equal(safe.addons[0].requiresAccount,true);assert.equal(safe.addons[0].url,'');
  assert.ok(!JSON.stringify(safe).includes('user-secret'));
  assert.deepEqual(safe.collections,[{id:'public',name:'Public'}]);
  assert.equal(source.addons[0].url,url);
});
test('URL con token desconocido se protege y la clasificación manual funciona',()=>{
  for(const addon of [{url:'https://service.test/manifest.json?token=source-secret'},{url:'https://service.test/private/manifest.json',requiresAccount:true,providerUrl:'https://service.test/configure'}]){
    const safe=shareableConfig(validateConfig(config([addon])));
    assert.equal(safe.addons[0].requiresAccount,true);assert.equal(safe.addons[0].url,'');
  }
});
test('resolver usa el enlace personal solo para el destino y no cambia la plantilla',()=>{
  const template=shareableConfig(validateConfig(config([{name:'Nuve+',url:'https://nuvehub.app/owner/manifest.json'}])));
  const own='https://nuvehub.app/friend/manifest.json';
  const result=resolvePersonal(template,{'addons:0':{mode:'own',url:own}},config([]));
  assert.equal(result.addons[0].url,own);assert.equal(result.addons[0].requiresAccount,undefined);
  assert.ok(!JSON.stringify(template).includes('friend'));
});
test('conservar y omitir no escriben el token del origen',()=>{
  const template=shareableConfig(validateConfig(config([{name:'Nuve+',url:'https://nuvehub.app/owner/manifest.json'}])));
  const target=validateConfig(config([{name:'Nuve+',url:'https://nuvehub.app/friend/manifest.json'}]));
  for(const mode of ['keep','skip']){
    const source=resolvePersonal(template,{'addons:0':{mode}},target);
    assert.deepEqual(mergeConfig(target,source,['addons']),target);
  }
});
test('rechaza páginas de configuración o enlaces inseguros como manifest personal',()=>{
  const template=shareableConfig(validateConfig(config([{name:'Nuve+',url:'https://nuvehub.app/owner/manifest.json'}])));
  for(const url of ['https://nuvehub.app/addons','javascript:alert(1)','http://service.test/manifest.json'])assert.throws(()=>resolvePersonal(template,{'addons:0':{mode:'own',url}},config([])));
});
test('el enlace personal sustituye solo el proveedor coincidente',()=>{
  const target=validateConfig(config([{name:'Nuve+',url:'https://nuvehub.app/old/manifest.json'},{name:'Otro',url:'https://other.test/manifest.json'}]));
  const source=validateConfig(config([{name:'Nuve+',url:'https://nuvehub.app/new/manifest.json'}]));
  const merged=mergeConfig(target,source,['addons']);
  assert.equal(merged.addons.length,2);assert.equal(merged.addons[0].url,source.addons[0].url);assert.deepEqual(merged.addons[1],target.addons[1]);
});
