import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {appendSection} from '../nuvio.mjs';
const original=global.fetch;
after(()=>{global.fetch=original;});
function mock(key,current,{inherit=false}={}) {
  const writes=[];
  global.fetch=async(url,options)=>{
    const path=new URL(url).pathname;
    assert.ok(!/library|settings|watched|watch_progress/.test(path));
    assert.ok(!['PATCH','DELETE'].includes(options.method));
    if(path.endsWith('sync_pull_profiles'))return Response.json([{profile_index:0,name:'Mi perfil intacto',uses_primary_addons:inherit,uses_primary_plugins:inherit}]);
    if(path.endsWith('sync_pull_collections'))return Response.json([{collections_json:current}]);
    if(path.endsWith('/'+key))return Response.json(current);
    if(path.includes('sync_push_')){writes.push(JSON.parse(options.body));return Response.json(null);}
    throw new Error('Unexpected endpoint: '+path);
  };
  return writes;
}
for(const key of ['addons','plugins'])test(`${key}: actualiza coincidencias, conserva orden y agrega nuevos`,async()=>{
  const existing={url:'https://old.test',name:'Mi nombre',enabled:false,sort_order:12,...(key==='plugins'?{repo_type:'personal'}:{})};
  const writes=mock(key,[existing]);
  const action=key==='addons'?'appendAddons':'appendPlugins';
  const result=await appendSection(action,{p_profile_id:0,items:[{...existing,name:'No sobrescribir',enabled:true},{url:'https://new.test',name:'Nuevo'}, {url:'https://new.test'}]},'Bearer target');
  assert.equal(result.added,1);assert.equal(writes.length,1);
  const rows=writes[0][key==='addons'?'p_addons':'p_plugins'];
  assert.deepEqual(rows[0],{...existing,name:'No sobrescribir',enabled:true});assert.equal(rows[1].sort_order,13);
  const noWrites=mock(key,[existing]);
  assert.equal((await appendSection(action,{p_profile_id:0,items:[existing]},'Bearer target')).added,0);
  assert.equal(noWrites.length,0);
});
test('colecciones existentes se conservan completas ante IDs coincidentes',async()=>{
  const existing={id:'one',name:'Favoritos',folders:[{name:'Mío',layout:'grid'}]};
  const writes=mock('collections',[existing]);
  await appendSection('appendCollections',{p_profile_id:0,items:[{id:'one',name:'No cambiar'},{id:'two',name:'Nuevo'}]},'Bearer target');
  assert.deepEqual(writes[0].p_collections_json,[existing,{id:'two',name:'Nuevo'}]);
});
test('un destino con herencia o perfil inexistente no se escribe',async()=>{
  const writes=mock('addons',[],{inherit:true});
  await assert.rejects(appendSection('appendAddons',{p_profile_id:0,items:[{url:'https://new.test'}]},'Bearer target'));
  await assert.rejects(appendSection('appendAddons',{p_profile_id:8,items:[]},'Bearer target'));
  assert.equal(writes.length,0);
});
test('Torrentio con ajustes en otra URL se actualiza sin tocar los demás addons',async()=>{
  const old={url:'https://torrentio.strem.fun/manifest.json',name:'Torrentio',enabled:true,sort_order:3};
  const other={url:'https://other.test/manifest.json',name:'Personal',enabled:false,sort_order:7};
  const configured={url:'https://torrentio.strem.fun/providers=yts|language=spanish/manifest.json',name:'Torrentio configurado',enabled:true};
  const writes=mock('addons',[old,other]);
  await appendSection('appendAddons',{p_profile_id:0,items:[configured]},'Bearer target');
  assert.equal(writes.length,1);
  assert.deepEqual(writes[0].p_addons,[{...configured,sort_order:3},other]);
});
