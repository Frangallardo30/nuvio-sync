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
export function mergeConfig(target, source, selected, mode) {
  const out = structuredClone(target);
  for (const key of selected) {
    if (mode === 'replace') out[key] = structuredClone(source[key]);
    else {
      const identity = item => key === 'collections' ? item.id : item.url;
      const map = new Map(target[key].map(item => [identity(item), item]));
      source[key].forEach(item => map.set(identity(item), item));
      out[key] = [...map.values()];
    }
  }
  return validateConfig(out);
}
