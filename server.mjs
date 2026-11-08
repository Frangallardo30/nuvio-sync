import {createServer} from 'node:http';
import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {validateConfig} from './model.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDir = process.env.DATA_DIR || join(root, 'data');
import {nuvio, routes, appendSection} from './nuvio.mjs';
async function jsonBody(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) {size += chunk.length; if (size > 2_000_000) throw Object.assign(new Error('Archivo demasiado grande (máximo 2 MB).'), {status: 413}); chunks.push(chunk);}
  try {return JSON.parse(Buffer.concat(chunks).toString() || '{}');} catch {throw Object.assign(new Error('JSON inválido.'), {status: 400});}
}
const attempts = new Map();
function rateLimit(req) {
  const key = req.socket.remoteAddress;
  const now = Date.now();
  for (const [ip, value] of attempts) if (value.until < now) attempts.delete(ip);
  const value = attempts.get(key) || {count: 0, until: now + 60000};
  attempts.set(key, value);
  if (++value.count > 12) throw Object.assign(new Error('Demasiados intentos. Espera un minuto.'), {status: 429});
}
export const server = createServer(async (req, res) => {
  const send = (status, body) => {res.writeHead(status, {'content-type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(body));};
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST') {
      // Same-origin JSON only. Never proxy arbitrary URLs or forward cookies.
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(403, {error: 'Origen no permitido.'});
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, {error: 'Se requiere JSON.'});
    }
    if (url.pathname === '/api/template') {
      if (req.method === 'GET') {
        try {return send(200, JSON.parse(await readFile(join(dataDir, 'template.json'), 'utf8')));} catch (e) {if (e.code === 'ENOENT') return send(200, null); throw e;}
      }
      if (req.method !== 'POST') return send(405, {error: 'Método no permitido.'});
      if (!process.env.OWNER_EMAIL) return send(503, {error: 'Configura OWNER_EMAIL en el servidor con tu correo de Nuvio para habilitar el guardado de plantillas.'});
      const token = req.headers.authorization;
      if (!token?.startsWith('Bearer ')) return send(401, {error: 'Conecta la cuenta propietaria.'});
      const user = await nuvio(...routes.user, null, token);
      if (user.email?.toLowerCase() !== process.env.OWNER_EMAIL.toLowerCase()) return send(403, {error: 'Solo la cuenta propietaria puede actualizar la plantilla.'});
      const body = await jsonBody(req);
      if (body.reviewed !== true) return send(400, {error: 'Revisa las URLs y claves antes de compartir.'});
      const template = {name: String(body.name || 'Mi configuración').slice(0, 80), updatedAt: new Date().toISOString(), config: validateConfig(body.config)};
      await mkdir(dataDir, {recursive: true, mode: 0o700});
      const pending = join(dataDir, `template-${crypto.randomUUID()}.tmp`);
      await writeFile(pending, JSON.stringify(template), {mode: 0o600});
      await rename(pending, join(dataDir, 'template.json'));
      return send(200, template);
    }
    if (url.pathname.startsWith('/api/nuvio/') && req.method === 'POST') {
      const action = url.pathname.split('/').at(-1);
      const token = req.headers.authorization;
      if (action !== 'login' && !token?.startsWith('Bearer ')) return send(401, {error: 'Conecta la cuenta de Nuvio.'});
      const body = await jsonBody(req);
      if (action === 'login') {
        rateLimit(req);
        if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.password) return send(400, {error: 'Introduce correo y contraseña.'});
        const result = await nuvio(...routes.login, {email: body.email, password: body.password});
        return send(200, {access_token: result.access_token, user: {id: result.user.id, email: result.user.email}});
      }
      if (action === 'addons' || action === 'plugins') {
        if (!Number.isInteger(body.profile) || body.profile < 0 || body.profile > 100) return send(400, {error: 'Perfil inválido.'});
        return send(200, await nuvio(`/rest/v1/${action}?select=*&profile_id=eq.${body.profile}&order=sort_order`, 'GET', null, token));
      }
      if (['appendAddons','appendPlugins','appendCollections'].includes(action)) return send(200, await appendSection(action, body, token));
      if (!['profiles','collections'].includes(action)) return send(404, {error: 'Operación no disponible.'});
      return send(200, await nuvio(...routes[action], body, token));
    }
    if (req.method !== 'GET') return send(405, {error: 'Método no permitido.'});
    const files = {'/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8']};
    if (!files[url.pathname]) return send(404, {error: 'No encontrado.'});
    const [file, type] = files[url.pathname];
    res.writeHead(200, {'content-type': type}); res.end(await readFile(join(root, 'public', file)));
  } catch (e) {send(e.status || 400, {error: e.status ? e.message : 'No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.'});}
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Nuvio Sync disponible en el puerto ${process.env.PORT || 3000}`));
}
