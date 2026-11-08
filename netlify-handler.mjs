import {nuvio, routes} from './nuvio.mjs';
import {validateConfig} from './model.mjs';

export const securityHeaders = {
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const json = (body, status=200) => Response.json(body,{status,headers:securityHeaders});
async function readBody(req) {
  // Bound streamed input as well as Content-Length; do not trust the header.
  if(Number(req.headers.get('content-length'))>2_000_000)throw Object.assign(new Error('Máximo 2 MB por solicitud.'),{status:413});
  const reader=req.body?.getReader();const chunks=[];let size=0;
  if(!reader)return {};
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader.cancel();throw Object.assign(new Error('Máximo 2 MB por solicitud.'),{status:413});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes)||'{}');}catch{throw Object.assign(new Error('JSON inválido.'),{status:400});}
}

// Dependency injection keeps storage and environment access outside the API logic.
export async function handleApi(req,{ownerEmail,getStore}) {
  try {
    const url=new URL(req.url),path=url.pathname,token=req.headers.get('authorization');
    if(!['GET','POST'].includes(req.method))return json({error:'Método no permitido.'},405);
    if(req.method==='POST'){
      const origin=req.headers.get('origin');
      if(origin&&new URL(origin).origin!==url.origin)return json({error:'Origen no permitido.'},403);
      if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Se requiere JSON.'},415);
    }
    if(path==='/api/template'){
      if(req.method==='GET')return json(await getStore().get('shared-template',{type:'json'}));
      if(!ownerEmail)return json({error:'Configura OWNER_EMAIL en Netlify con tu correo de Nuvio y vuelve a desplegar.'},503);
      if(!token?.startsWith('Bearer '))return json({error:'Conecta la cuenta propietaria.'},401);
      const user=await nuvio(...routes.user,null,token);
      if(user.email?.toLowerCase()!==ownerEmail.toLowerCase())return json({error:'Solo la cuenta propietaria puede actualizar la plantilla.'},403);
      const body=await readBody(req);
      if(body.reviewed!==true)return json({error:'Revisa las URLs y claves antes de compartir.'},400);
      const template={name:String(body.name||'Mi configuración').slice(0,80),updatedAt:new Date().toISOString(),config:validateConfig(body.config)};
      await getStore().setJSON('shared-template',template);
      return json(template);
    }
    if(!path.startsWith('/api/nuvio/'))return json({error:'No encontrado.'},404);
    if(req.method!=='POST')return json({error:'Método no permitido.'},405);
    const action=path.slice('/api/nuvio/'.length);
    const allowed=['login','profiles','addons','plugins','collections','pushAddons','pushPlugins','pushCollections'];
    if(!allowed.includes(action))return json({error:'Operación no disponible.'},404);
    if(action!=='login'&&!token?.startsWith('Bearer '))return json({error:'Conecta la cuenta de Nuvio.'},401);
    const body=await readBody(req);
    if(action==='login'){
      if(typeof body.email!=='string'||typeof body.password!=='string'||!body.password)return json({error:'Introduce correo y contraseña.'},400);
      const result=await nuvio(...routes.login,{email:body.email,password:body.password});
      return json({access_token:result.access_token,user:{id:result.user.id,email:result.user.email}});
    }
    if(action==='addons'||action==='plugins'){
      if(!Number.isInteger(body.profile)||body.profile<0||body.profile>100)return json({error:'Perfil inválido.'},400);
      return json(await nuvio(`/rest/v1/${action}?select=*&profile_id=eq.${body.profile}&order=sort_order`,'GET',null,token));
    }
    return json(await nuvio(...routes[action],body,token));
  }catch(e){return json({error:e.status?e.message:'No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.'},e.status||400);}
}
