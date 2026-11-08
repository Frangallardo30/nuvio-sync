export const sections = ['addons', 'plugins', 'collections'];
export function validateConfig(input) {
  if (!input || !sections.every(k => Array.isArray(input[k]))) throw new Error('La configuración debe contener addons, plugins y collections.');
  const result = {};
  for (const key of sections) {
    if (input[key].length > 1000) throw new Error('Demasiados elementos. Máximo: 1000 por sección.');
    result[key] = input[key].map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Elemento inválido.');
      if (key === 'collections') {
        if (typeof item.id !== 'string' || !item.id) throw new Error('Una colección no tiene identificador.');
        // Collections contain nested catalog references and display properties.
        // Preserve the complete supported structure; do not copy account-level metadata.
        const {user_id, profile_id, ...collection} = item;
        return collection;
      }
      const url = new URL(item.url);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('La URL de un complemento no es válida.');
      return { url: item.url, name: typeof item.name === 'string' ? item.name.slice(0, 250) : null, enabled: item.enabled !== false, sort_order: index, ...(key === 'plugins' ? {repo_type: typeof item.repo_type === 'string' ? item.repo_type : null} : {}) };
    });
  }
  return result;
}
// Do not match by display name: unrelated services can share a name.
export function addonIdentity(item, key) {
  if (key === 'collections') return item.id;
  const url = new URL(item.url);
  // Torrentio encodes its settings in the path before /manifest.json.
  if (key === 'addons' && url.hostname === 'torrentio.strem.fun' && /\/manifest\.json\/?$/.test(url.pathname)) return url.origin + '/torrentio';
  // Query parameters can carry configuration; retain the service/path identity.
  return url.origin + url.pathname.replace(/\/$/, '');
}
export function mergeConfig(target, source, selected) {
  const out = structuredClone(target);
  for (const key of selected) {
    const identity = item => addonIdentity(item, key);
    const applied = new Set();
    let nextOrder = Math.max(-1, ...out[key].map(x => Number.isFinite(x.sort_order) ? x.sort_order : -1)) + 1;
    for (const item of source[key]) {
      const id = identity(item);
      if (applied.has(id)) continue;
      applied.add(id);
      const index = out[key].findIndex(x => identity(x) === id);
      if (index >= 0) {
        // Collections keep their existing content; only addon/plugin settings change.
        if (key !== 'collections') {
          const position = out[key][index].sort_order;
          out[key][index] = {...structuredClone(item), sort_order: position};
          out[key] = out[key].filter((x,i) => i === index || identity(x) !== id);
        }
      } else out[key].push({...structuredClone(item), ...(key === 'collections' ? {} : {sort_order: nextOrder++})});
    }
  }
  return out;
}
