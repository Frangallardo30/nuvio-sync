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
