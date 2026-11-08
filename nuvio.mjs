import {mergeConfig, validateConfig} from './model.mjs';
const base = 'https://api.nuvio.tv';
// Public anonymous client key, not an account credential. Every private operation
// additionally requires that account's short-lived access token.
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNTIxMzQ2LCJleHAiOjE5MzkyMDEzNDZ9.tmQaj682pwzehpqlgCDMnySOqiUvpgRbrE43T4VJpDI';
export const routes = {
  login: ['/auth/v1/token?grant_type=password', 'POST'],
  profiles: ['/rest/v1/rpc/sync_pull_profiles', 'POST'],
  collections: ['/rest/v1/rpc/sync_pull_collections', 'POST'],
  pushAddons: ['/rest/v1/rpc/sync_push_addons', 'POST'],
  pushPlugins: ['/rest/v1/rpc/sync_push_plugins', 'POST'],
  pushCollections: ['/rest/v1/rpc/sync_push_collections', 'POST'],
  user: ['/auth/v1/user', 'GET'],
};
export async function nuvio(path, method, body, token) {
  let response;
  try {
    response = await fetch(base + path, {method, headers: {'apikey': apiKey, 'content-type': 'application/json', ...(token ? {Authorization: token} : {})}, ...(method !== 'GET' ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(25000)});
  } catch { throw Object.assign(new Error('No se pudo conectar con Nuvio. Inténtalo de nuevo.'), {status: 502}); }
  const text = await response.text();
  let value;
  try { value = text ? JSON.parse(text) : null; } catch { throw Object.assign(new Error('Nuvio devolvió una respuesta inesperada.'), {status: 502}); }
  if (!response.ok) throw Object.assign(new Error(response.status === 401 || response.status === 400 ? 'Nuvio rechazó la solicitud. Comprueba tus credenciales o vuelve a conectar la cuenta.' : 'Nuvio no pudo completar la operación.'), {status: response.status >= 500 ? 502 : response.status});
  return value;
}

export async function appendSection(action, body, token) {
  const key = {appendAddons:'addons', appendPlugins:'plugins', appendCollections:'collections'}[action];
  if (!key) throw Object.assign(new Error('Operación no disponible.'), {status:404});
  const profile = body.p_profile_id;
  if (!Number.isInteger(profile) || profile < 0 || profile > 100) throw Object.assign(new Error('Perfil inválido.'), {status:400});
  const source = validateConfig({addons:[],plugins:[],collections:[],[key]:body.items});
  if(source[key].some(x=>x.requiresAccount))throw Object.assign(new Error('Completa u omite las conexiones personales antes de instalar.'),{status:400});
  const profiles = await nuvio(...routes.profiles,{},token);
  const selected = profiles?.find(p => p.profile_index === profile);
  if (!selected) throw Object.assign(new Error('Perfil no encontrado.'), {status:400});
  if ((key === 'addons' && selected.uses_primary_addons) || (key === 'plugins' && selected.uses_primary_plugins)) throw Object.assign(new Error('El perfil hereda complementos. Selecciona el perfil principal.'),{status:409});
  let current;
  if (key === 'collections') {
    const rows = await nuvio(...routes.collections,{p_profile_id:profile},token);
    current = rows?.[0]?.collections_json ?? [];
    if (typeof current === 'string') current = JSON.parse(current);
  } else {
    const rows = await nuvio(`/rest/v1/${key}?select=*&profile_id=eq.${profile}&order=sort_order`,'GET',null,token);
    if (!Array.isArray(rows)) throw new Error('Respuesta inválida del destino.');
    current = rows.map(x => ({url:x.url,name:x.name,enabled:x.enabled,sort_order:x.sort_order,...(key==='plugins'?{repo_type:x.repo_type}:{})}));
  }
  if (!Array.isArray(current)) throw new Error('Respuesta inválida del destino.');
  const target={addons:[],plugins:[],collections:[],[key]:current};
  const combined=mergeConfig(target,source,[key])[key];
  const added=combined.length-current.length;
  const updated=current.filter((item,index)=>JSON.stringify(item)!==JSON.stringify(combined[index])).length;
  if (JSON.stringify(combined)===JSON.stringify(current)) return {added:0,updated:0};
  const push={addons:'pushAddons',plugins:'pushPlugins',collections:'pushCollections'}[key];
  const param={addons:'p_addons',plugins:'p_plugins',collections:'p_collections_json'}[key];
  await nuvio(...routes[push],{p_profile_id:profile,[param]:combined},token);
  return {added,updated};
}
