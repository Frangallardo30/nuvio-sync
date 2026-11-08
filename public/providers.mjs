const catalog = [
  ['nuve-plus','Nuve+','https://nuvehub.app/addons?tab=plus',/nuve\+|nuveplus|nuve plus|nubeplus|v plus/i,/nuvehub\.app$/],
  ['nuve-debrid','Nuve Debrid','https://nuvehub.app/addons?tab=debrid',/nuve.?debrid/i,/^$/],
  ['addonlatam','AddonLatam','https://addonlatampagina.duckdns.org',/addon.?latam/i,/addonlatampagina\.duckdns\.org$/],
  ['lat-add','LAT-ADD','https://discord.gg/lat-add',/lat[- ]?add/i,/^$/],
  ['progreso','Progreso Latino','https://progreso-latino.xyz/register',/progreso.?latino/i,/progreso-latino\.xyz$/],
  ['latinobox','LatinoBox','https://latinobox.daleplay.biz',/latino.?box/i,/latinobox\.daleplay\.biz$/],
  ['ltan','LTAN','https://ltan.onrender.com',/\bltan\b/i,/ltan\.onrender\.com$/],
];
export function personalProvider(item) {
  let url;try{url=new URL(item.url);}catch{}
  // Names are a conservative privacy signal, never an automatic replacement identity.
  const record=catalog.find(x=>x[3].test(item.name||'')) || catalog.find(x=>url && x[4].test(url.hostname));
  const encoded=url ? decodeURIComponent(url.href) : '';
  const suspicious=/(?:apikey|api_key|token|password|credential|realdebrid|alldebrid|premiumize|torbox|debridlink)[=:|%]|eyJ[A-Za-z0-9_-]{10,}\./i.test(encoded);
  if(!record&&!item.requiresAccount&&!suspicious)return null;
  const providerUrl=record?.[2] || item.providerUrl || null;
  if(providerUrl){const u=new URL(providerUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash){if(!record)throw new Error('Usa una página HTTPS de registro/configuración sin tokens ni parámetros.');}}
  return {providerId:record?.[0]||item.providerId||'personal',providerUrl,name:item.name||record?.[1]||'Complemento personal'};
}
export function shareableConfig(config) {
  const result=structuredClone(config);
  for(const key of ['addons','plugins'])result[key]=result[key].map(item=>{
    const provider=personalProvider(item);
    return provider?{...provider,url:'',requiresAccount:true,enabled:item.enabled!==false,sort_order:item.sort_order,...(key==='plugins'?{repo_type:item.repo_type??null}:{})}:item;
  });
  // Do not publish personal URLs hidden in nested collection catalog references.
  const personalUrls=new Set(['addons','plugins'].flatMap(k=>config[k].filter(x=>personalProvider(x)).map(x=>x.url)).filter(Boolean));
  const sensitive=value=>typeof value==='string' ? personalUrls.has(value)||(/^https?:\/\//.test(value)&&!!personalProvider({url:value})) : value&&typeof value==='object' ? Object.values(value).some(sensitive):false;
  result.collections=result.collections.filter(x=>!sensitive(x));
  return result;
}
export function resolvePersonal(config, answers, destination) {
  const out=structuredClone(config);
  for(const key of ['addons','plugins'])out[key]=out[key].flatMap((item,index)=>{
    if(!item.requiresAccount)return [item];
    const answer=answers[`${key}:${index}`];
    if(!answer||answer.mode==='skip')return [];
    if(answer.mode==='keep')return []; // Destination already contains it; no write needed.
    const url=new URL(answer.url);
    if(url.protocol!=='https:'||url.username||url.password||!url.pathname.endsWith('/manifest.json'))throw new Error('Pega el enlace HTTPS completo que termina en /manifest.json, no la página de configuración.');
    const {requiresAccount,providerId,providerUrl,...addon}=item;
    return [{...addon,url:url.href}];
  });
  return out;
}
