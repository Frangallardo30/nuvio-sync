import {renderGuide,bindGuide} from '/guide.mjs';
import {shareableConfig, personalProvider, resolvePersonal} from '/providers.mjs';
import {mergeConfig, addonIdentity, validateConfig} from '/model.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys = ['addons', 'plugins', 'collections'];
const labels = {addons:'Add-ons', plugins:'Plugins', collections:'Colecciones'};
let mode = location.hash.slice(1) || 'plantilla', template = null, source = null, backup = null, busy = false, reviewBusy = false;
const accounts = {source:null, target:null};
const selected = new Set(keys);

function toast(message) {$('#toast').textContent = message; $('#toast').classList.add('visible'); setTimeout(() => $('#toast').classList.remove('visible'), 7000);}
async function request(path, body, token) {
  const res = await fetch(path, {method:body === undefined ? 'GET' : 'POST', headers:{'content-type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
  return data;
}
const api = (action, body, account) => request(`/api/nuvio/${action}`, body, account?.token);
function emptyConfig(){return {addons:[], plugins:[], collections:[]};}
function download(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href=url; link.download=filename; link.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function stats(config) {return `<div class="stats">${keys.map(k=>`<div class="stat"><strong>${config?.[k]?.length ?? '—'}</strong><span>${labels[k]}</span></div>`).join('')}</div>`;}
function art(){return '<div class="template-art" aria-hidden="true"><div class="orbit"></div><div class="orbit second"></div><div class="orbit third"></div><div class="art-center">n↗</div><div class="art-chip one">✦ &nbsp; Tu selección personal</div><div class="art-chip two">⇄ &nbsp; Lista para sincronizar</div></div>';}
function connection(role, title, number) {
  const account = accounts[role];
  return `<section class="panel"><div class="step-heading"><span class="step-number">${number}</span><h2>${title}</h2></div>${account ? `<div class="connection"><strong>${esc(account.email)}</strong><span>● Cuenta conectada · sesión temporal</span></div><label class="form-label" for="profile-${role}">Perfil ${role==='source'?'de origen':'de destino'}</label><select class="field" id="profile-${role}" data-profile="${role}">${account.profiles.map(p=>`<option value="${p.profile_index}" ${p.profile_index===account.profile?'selected':''}>${esc(p.name || `Perfil ${p.profile_index}`)}</option>`).join('')}</select><button class="text-button" data-action="disconnect-one" data-role="${role}">Cambiar de cuenta</button>` : `<form data-login="${role}"><label class="form-label" for="email-${role}">Correo de Nuvio</label><input class="field" id="email-${role}" name="email" type="email" autocomplete="username" placeholder="tu@correo.com" required><label class="form-label" for="password-${role}">Contraseña</label><input class="field" id="password-${role}" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña de Nuvio" required><button class="primary full" type="submit">Conectar ${role==='source'?'cuenta de origen':'cuenta de destino'} <span>↗</span></button><p class="small-note">La contraseña se usa para conectar y no se guarda.</p><p class="error no-margin" role="alert" data-error="${role}"></p></form>`}</section>`;
}
function items(config) {
  return keys.map(k=>`<p class="section-label">${labels[k].toUpperCase()}</p><ul class="list">${config[k].length ? config[k].map(x=>`<li><span>${esc(x.name || x.title || 'Sin nombre')}</span><small>${x.requiresAccount ? 'Requiere tu enlace' : x.enabled === false ? 'Desactivado' : '✓'}</small></li>`).join('') : '<li class="muted">Sin elementos</li>'}</ul>`).join('');
}
function options(config) {
  return `<section class="panel"><div class="step-heading"><span class="step-number">3</span><h2>Elige qué transferir</h2></div><div class="options">${keys.map(k=>`<label class="option"><input type="checkbox" data-section="${k}" ${selected.has(k)?'checked':''}>${labels[k]}<span>${config[k].length} elementos</span></label>`).join('')}</div><p class="notice">Se agregan los complementos que faltan. Si coinciden, se aplica la configuración del origen conservando su posición. Los demás se mantienen. No se modifican biblioteca, nombres de perfiles ni preferencias.</p><button class="primary full" data-action="review" ${!accounts.target || !selected.size?'disabled':''}>Revisar configuración <span>→</span></button></section>`;
}
function render() {
  if (!['plantilla','copiar','administrar','guia'].includes(mode)) mode='plantilla';
  const titles = {guia:['Tu guía.<br>Paso a paso.','Los complementos del PDF y de tu perfil, con enlaces, instrucciones y capturas para configurar tu cuenta.','Guía de configuración'],plantilla:['Todo tu Nuvio.<br>Listo para compartir.','Instala una configuración preparada con tus add-ons, plugins y colecciones favoritos.','Instalar plantilla'], copiar:['Tu configuración.<br>En otra cuenta.','Conecta el origen y el destino. Elige qué copiar y revisa los cambios antes de aplicarlos.','Copiar cuentas'], administrar:['Tu mejor setup.<br>Una sola plantilla.','Conecta tu cuenta, elige un perfil y guarda la configuración que quieres compartir.','Mi plantilla']};
  $('#title').innerHTML=titles[mode][0]; $('#intro').textContent=titles[mode][1]; $('#breadcrumb').textContent=titles[mode][2];
  document.querySelectorAll('[data-nav]').forEach(el=>{el.classList.toggle('active', el.dataset.nav===mode); if(el.dataset.nav===mode)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  document.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('active',el.dataset.mode===mode));
  $('.mode-tabs').hidden=mode==='guia';$('.footnotes').hidden=mode==='guia';
  if(mode==='guia'){$('#workspace').innerHTML=renderGuide();bindGuide($('#workspace'),toast);return;}
  const config = mode==='plantilla' ? template?.config : source;
  if (mode==='plantilla') {
    $('#workspace').innerHTML=`<div class="layout"><section class="panel"><div class="panel-heading"><h2>Tu plantilla compartida</h2><span class="badge">${template?'DISPONIBLE':'POR PREPARAR'}</span></div>${art()}${template ? `<h3 class="template-name">${esc(template.name)}</h3><p>Una selección preparada para instalar en el perfil que elijas.</p>${stats(template.config)}<details><summary class="mini-link">Ver contenido de la plantilla</summary>${items(template.config)}</details><p class="updated">Última actualización <span>${new Date(template.updatedAt).toLocaleDateString('es')}</span></p>` : `<p class="empty-title">Aquí irá tu configuración.</p><p class="empty-copy">Guarda tu perfil como plantilla y tus amigos podrán instalarlo desde esta sección.</p>${stats(null)}<a href="#administrar" class="secondary full">Preparar mi plantilla <span>↗</span></a><p class="updated">Todavía no hay una plantilla guardada.</p>`}</section><div class="stack">${connection('target','Conecta la cuenta que recibe',template?2:1)}${template?options(template.config):''}</div></div>`;
  } else if(mode==='copiar') {
    $('#workspace').innerHTML=`<div class="layout"><div class="stack">${connection('source','Cuenta de origen',1)}${source?`<section class="panel"><h2>Configuración de origen</h2>${stats(source)}<details><summary class="mini-link">Ver elementos</summary>${items(source)}</details></section>`:''}</div><div class="stack">${connection('target','Cuenta de destino',2)}${source?options(source):'<section class="panel"><h2>Primero, conecta el origen.</h2><p>Leeremos sus add-ons, plugins y colecciones. El origen no se modifica.</p></section>'}</div></div>`;
  } else {
    $('#workspace').innerHTML=`<div class="layout"><div class="stack">${connection('source','Conecta tu cuenta propietaria',1)}<section class="panel"><h2>¿Cómo se mantiene?</h2><p>La plantilla guarda una instantánea del perfil. Actualízala aquí cuando cambies tus add-ons o colecciones.</p><p>Solo la cuenta indicada en <code>OWNER_EMAIL</code> en el servidor puede guardarla. Las cuentas de tus amigos pueden instalarla.</p><label class="form-label" for="import-file">Restaurar desde una copia JSON</label><input class="field" id="import-file" type="file" accept=".json,application/json"><p class="small-note">El archivo se carga para revisar. No aplica cambios automáticamente.</p></section></div><section class="panel"><div class="panel-heading"><h2>Contenido de la plantilla</h2><span class="badge">${source?'LISTO PARA REVISAR':'SIN CONECTAR'}</span></div>${source?`<label class="form-label" for="template-name">Nombre de la plantilla</label><input id="template-name" class="field" maxlength="80" value="${esc(template?.name || 'Mi selección Nuvio')}">${stats(source)}${items(source)}<p class="notice">Revisa las URLs antes de compartir: pueden incluir claves o configuraciones privadas. La plantilla será accesible para quienes puedan abrir esta web.</p><div class="row"><button class="secondary" data-action="export-source">Exportar JSON ↓</button><button class="primary" data-action="save-template">Revisar y guardar →</button></div>`:`${art()}<p>Conecta tu cuenta y selecciona el perfil que quieres usar como plantilla, o importa una copia.</p>`}</section></div>`;
  }
  if (backup) $('#workspace').insertAdjacentHTML('beforeend','<p class="top-space"><button class="secondary" data-action="download-backup">Descargar último respaldo ↓</button> <span class="muted">Disponible durante esta sesión.</span></p>');
}
function normalize(config) {return validateConfig(config);}
async function readConfig(account, profile=account.profile, inherit=false) {
  const p=account.profiles.find(p=>p.profile_index===profile);
  const [addons,plugins,rows]=await Promise.all([api('addons',{profile:inherit&&p?.uses_primary_addons?0:profile},account),api('plugins',{profile:inherit&&p?.uses_primary_plugins?0:profile},account),api('collections',{p_profile_id:profile},account)]);
  let collections=rows?.[0]?.collections_json??[];
  if(typeof collections==='string')collections=JSON.parse(collections);
  return normalize({addons:addons??[],plugins:plugins??[],collections});
}
async function loadSource(){source=await readConfig(accounts.source, accounts.source.profile, true);}
function merge(target, origin, sections) {return normalize(mergeConfig(target,origin,sections));}
async function writeSection(account,k,config){
  const action={addons:'appendAddons',plugins:'appendPlugins',collections:'appendCollections'}[k];
  await api(action,{p_profile_id:account.profile,items:config[k]},account);
}
function reviewPanel(html) {$('#review-content').innerHTML=html; if(!$('#review-dialog').open)$('#review-dialog').showModal();}
async function collectPersonal(config,destination) {
  const answers={};
  const tasks=['addons','plugins'].flatMap(key=>selected.has(key)?config[key].flatMap((item,index)=>item.requiresAccount?[{key,index,item}]:[]):[]);
  for(let step=0;step<tasks.length;step++){
    const {key,index,item}=tasks[step];
    const existing=destination[key].find(x=>{const p=personalProvider(x);return p && (p.providerId!=='personal'?p.providerId===item.providerId:x.name===item.name);});
    reviewPanel(`<span class="badge">CONEXIONES PERSONALES · ${step+1}/${tasks.length}</span><h2>${esc(item.name)}</h2><p>Inicia sesión en la página del proveedor con tu propia cuenta, copia el enlace de instalación y pégalo aquí. No necesitas compartir tu contraseña con esta web.</p>${item.providerUrl?`<a class="secondary full" href="${esc(item.providerUrl)}" target="_blank" rel="noopener noreferrer">Abrir proveedor e iniciar sesión ↗</a>`:'<p class="notice">La plantilla no indica la página de este proveedor. Consulta a quien la preparó o continúa sin instalarlo.</p>'}<label class="form-label top-space" for="personal-choice">¿Cómo quieres continuar?</label><select id="personal-choice" class="field">${existing?'<option value="keep">Conservar mi enlace ya instalado</option>':''}<option value="own">Pegar mi enlace personal</option><option value="skip">Omitir este complemento</option></select><label class="form-label" for="personal-url">Tu enlace de instalación</label><input id="personal-url" class="field" type="url" autocomplete="off" spellcheck="false" placeholder="https://proveedor/tu-enlace/manifest.json"><p class="small-note">El enlace solo se usa para instalar en tu cuenta. No se guarda en la plantilla compartida.</p><p id="personal-error" class="error" role="alert"></p><button class="primary full" id="personal-next">Continuar →</button>`);
    const sync=()=>{$('#personal-url').disabled=$('#personal-choice').value!=='own';};$('#personal-choice').onchange=sync;sync();
    const answer=await new Promise(resolve=>{
      const dialog=$('#review-dialog');const cancel=()=>resolve(null);dialog.addEventListener('close',cancel,{once:true});
      $('#personal-next').onclick=()=>{
        const answer={mode:$('#personal-choice').value,url:$('#personal-url').value.trim()};
        try{resolvePersonal({addons:key==='addons'?[item]:[],plugins:key==='plugins'?[item]:[],collections:[]},{[`${key}:0`]:answer},destination);}catch(e){$('#personal-error').textContent=e.message;return;}
        dialog.removeEventListener('close',cancel);resolve(answer);
      };
    });
    if(!answer)return null;
    answers[`${key}:${index}`]=answer;
  }
  return resolvePersonal(config,answers,destination);
}
async function reviewTransfer(){
  const account=accounts.target;let origin=mode==='plantilla'?template?.config:source;
  if(!account||!origin||!selected.size)return;
  if(accounts.source && mode==='copiar' && accounts.source.id===account.id && accounts.source.profile===account.profile)throw new Error('El origen y el destino deben ser perfiles diferentes.');
  const profile=account.profiles.find(p=>p.profile_index===account.profile);
  if((selected.has('addons')&&profile.uses_primary_addons)||(selected.has('plugins')&&profile.uses_primary_plugins))throw new Error('El perfil de destino hereda complementos del principal. Elige el perfil principal o desactiva la herencia en Nuvio.');
  reviewPanel('<h2>Leyendo el destino…</h2><p>Preparamos el resumen y el respaldo.</p>');
  try {
    const before=await readConfig(account);
    origin=shareableConfig(origin);
    origin=await collectPersonal(origin,before);
    if(!origin)return;
    const sectionList=[...selected]; const after=merge(before,origin,sectionList);
    const target={...account};
    reviewPanel(`<span class="badge">REVISIÓN FINAL</span><h2>Así quedará el destino.</h2><p><strong>${esc(target.email)}</strong> · ${esc(profile.name)}<br>Modo: Agregar y actualizar complementos coincidentes</p>${sectionList.map(k=>`<div class="review-row"><span>${labels[k]}</span><span>${before[k].length} → <strong>${after[k].length}</strong> · ${k==='collections'?0:origin[k].filter(x=>before[k].some(y=>addonIdentity(x,k)===addonIdentity(y,k))).length} coincidencias a configurar</span></div>`).join('')}<p>Se guardará un respaldo en esta sesión. Descárgalo antes de aplicar y consérvalo para recuperar la configuración si hace falta.</p><button class="secondary full" id="review-backup">Descargar respaldo JSON ↓</button><p class="notice">Las URLs de los complementos pueden llevar claves del origen. Confirma que puedes compartirlas. Esto no transfiere suscripciones.</p><label class="check-review"><input id="consent" type="checkbox"> Tengo autorización sobre la cuenta de destino y he revisado los cambios y las claves compartidas.</label><button class="primary full" id="apply-transfer" disabled>Aplicar configuración →</button><p id="transfer-log" class="progress-log" role="status"></p>`);
    backup={version:1,createdAt:new Date().toISOString(),profile:target.profile,config:before};
    $('#review-backup').onclick=()=>download(backup,'nuvio-respaldo.json');
    $('#consent').onchange=()=>$('#apply-transfer').disabled=!$('#consent').checked;
    $('#apply-transfer').onclick=async()=>{
      const button=$('#apply-transfer');button.disabled=true;reviewBusy=true;const log=$('#transfer-log');const written=[];
      try {
        // Detect changes since review before starting the first write.
        log.textContent='Comprobando que el destino no haya cambiado…';
        const fresh=await readConfig(target);
        if(JSON.stringify(fresh)!==JSON.stringify(before))throw new Error('El destino cambió desde la revisión. Cierra el resumen y vuelve a revisar.');
        for(const k of sectionList){log.textContent+=`\nAplicando ${labels[k]}…`;written.push(k);await writeSection(target,k,origin);}
        const check=await readConfig(target);
        for(const k of sectionList)if(JSON.stringify(check[k])!==JSON.stringify(after[k]))throw new Error('La lectura posterior no coincide con lo enviado.');
        log.textContent+='\n✓ Configuración aplicada y comprobada. Abre Nuvio y sincroniza el perfil.';log.classList.add('success');button.textContent='Configuración aplicada ✓';toast('Configuración aplicada y verificada.');
      } catch(e) {
        log.textContent+=`\n${e.message}`;
        if(written.length)log.textContent+='\nLa operación puede haber agregado algunos elementos. No se restaurarán listas anteriores automáticamente. Puedes volver a revisar y aplicar la configuración pendiente.';
        log.classList.add('error');button.textContent='Operación detenida';
      } finally {reviewBusy=false;}
    };
  } catch(e){$('#review-dialog').close();throw e;}
}
function reviewSave(){
  if(!source)throw new Error('Primero conecta un perfil o importa su configuración.');
  if(!accounts.source)throw new Error('Conecta la cuenta propietaria para guardar una plantilla compartida.');
  const name=$('#template-name').value.trim()||'Mi selección Nuvio';
  const draft=shareableConfig(source);
  reviewPanel(`<span class="badge">PLANTILLA COMPARTIDA</span><h2>Revisa lo que compartes.</h2><p>Los proveedores reconocidos y los enlaces con indicios de claves se convierten en pasos de conexión personal. Marca los demás complementos que requieran cuenta e indica dónde obtener su enlace. Revisa también las colecciones; las que referencian enlaces personales se omiten al compartir.</p><div id="provider-controls">${['addons','plugins'].flatMap(key=>draft[key].map((item,index)=>`<div class="panel top-space"><strong>${esc(item.name||'Sin nombre')}</strong><label class="check-review"><input type="checkbox" data-personal-key="${key}" data-personal-index="${index}" ${item.requiresAccount?'checked':''}>Requiere cuenta o enlace personal</label><label class="form-label" for="provider-${key}-${index}">Página para obtener su propio enlace</label><input class="field" id="provider-${key}-${index}" data-provider-key="${key}" data-provider-index="${index}" type="url" placeholder="https://proveedor/configure" value="${esc(item.providerUrl||'')}"></div>`)).join('')}</div><details><summary class="mini-link">Ver configuración avanzada</summary><label class="form-label top-space" for="draft-json">Configuración completa (JSON editable)</label><textarea id="draft-json" class="url-review" spellcheck="false"></textarea></details><label class="check-review"><input id="save-consent" type="checkbox"> He revisado el contenido y autorizo compartir esta configuración con quienes accedan a la web.</label><button id="confirm-save" class="primary full" disabled>Guardar plantilla compartida</button><p id="save-error" class="error" role="alert"></p>`);
  $('#draft-json').value=JSON.stringify(draft,null,2);
  $('#provider-controls').onchange=event=>{
    const control=event.target;const key=control.dataset.personalKey||control.dataset.providerKey;
    if(!key)return;
    const index=Number(control.dataset.personalIndex??control.dataset.providerIndex);
    draft[key][index].requiresAccount=$(`[data-personal-key="${key}"][data-personal-index="${index}"]`).checked;
    draft[key][index].providerUrl=$(`#provider-${key}-${index}`).value.trim()||null;
    if(!draft[key][index].requiresAccount && !draft[key][index].url){toast('Este proveedor ya fue protegido. Mantén la conexión personal o elimínalo desde la configuración avanzada.');draft[key][index].requiresAccount=true;control.checked=true;}
    $('#draft-json').value=JSON.stringify(draft,null,2);$('#save-consent').checked=false;$('#confirm-save').disabled=true;
  };
  $('#save-consent').onchange=()=>$('#confirm-save').disabled=!$('#save-consent').checked;
  $('#draft-json').oninput=()=>{$('#save-consent').checked=false;$('#confirm-save').disabled=true;};
  $('#confirm-save').onclick=async()=>{
    $('#confirm-save').disabled=true;reviewBusy=true;
    try{const config=JSON.parse($('#draft-json').value);normalize(config);template=await request('/api/template',{name,config,reviewed:true},accounts.source.token);$('#review-dialog').close();toast('Plantilla guardada. Ya se puede instalar desde el inicio.');location.hash='plantilla';render();}
    catch(e){$('#save-error').textContent=e.message;$('#confirm-save').disabled=false;}
    finally{reviewBusy=false;}
  };
}
document.addEventListener('submit',async event=>{
  const role=event.target.dataset.login;if(!role)return;event.preventDefault();if(busy)return;busy=true;
  const form=event.target,button=form.querySelector('button'),error=form.querySelector('[data-error]');button.disabled=true;button.textContent='Conectando…';error.textContent='';
  try {
    const fields=new FormData(form);const auth=await api('login',{email:fields.get('email'),password:fields.get('password')});form.elements.password.value='';fields.delete('password');
    const account={token:auth.access_token,email:auth.user.email,id:auth.user.id,profiles:[]};
    account.profiles=await api('profiles',{},account);
    if(!Array.isArray(account.profiles)||!account.profiles.length)throw new Error('Esta cuenta no tiene perfiles disponibles. Crea uno en Nuvio.');
    account.profile=account.profiles[0].profile_index;accounts[role]=account;
    if(role==='source')await loadSource();render();toast('Cuenta conectada.');
  } catch(e){accounts[role]=null;if(role==='source')source=null;error.textContent=e.message;button.disabled=false;button.textContent='Volver a conectar';}
  finally{busy=false;}
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.dataset.section){el.checked?selected.add(el.dataset.section):selected.delete(el.dataset.section);const button=$('[data-action="review"]');if(button)button.disabled=!accounts.target||!selected.size;}
  if(el.dataset.profile){
    if(busy)return;busy=true;const role=el.dataset.profile;const previous=accounts[role].profile;accounts[role].profile=Number(el.value);el.disabled=true;
    try {if(role==='source')await loadSource();render();}catch(e){accounts[role].profile=previous;el.value=previous;el.disabled=false;toast(e.message);}finally{busy=false;}
  }
  if(el.id==='import-file' && el.files[0]){
    try{if(el.files[0].size>2_000_000)throw new Error('El archivo supera los 2 MB.');const value=JSON.parse(await el.files[0].text());source=normalize(value.config??value);render();toast('Copia importada para revisar. Abre Copiar cuentas para aplicarla al destino.');}catch(e){toast(e.message);}
  }
});
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el || busy || reviewBusy)return;
  const action=el.dataset.action;
  try{
    if(action==='disconnect-one'){accounts[el.dataset.role]=null;if(el.dataset.role==='source')source=null;render();}
    if(action==='export-source')download({version:1,config:source},'nuvio-configuracion.json');
    if(action==='download-backup')download(backup,'nuvio-respaldo.json');
    if(action==='save-template')reviewSave();
    if(action==='review'){busy=true;await reviewTransfer();}
  }catch(e){toast(e.message);}finally{busy=false;}
});
$('#disconnect').onclick=()=>{if(busy||reviewBusy)return;accounts.source=null;accounts.target=null;source=null;backup=null;render();toast('Conexiones cerradas y datos de sesión eliminados.');};
$('#review-dialog').addEventListener('cancel',event=>{if(reviewBusy)event.preventDefault();});
$('#review-dialog form').addEventListener('submit',event=>{if(reviewBusy)event.preventDefault();});
window.addEventListener('hashchange',()=>{if(reviewBusy)return;mode=location.hash.slice(1)||'plantilla';render();});
window.addEventListener('beforeunload',event=>{if(reviewBusy){event.preventDefault();event.returnValue='';}});
try{template=await request('/api/template');}catch(e){toast(`No se pudo cargar la plantilla: ${e.message}`);}
render();
