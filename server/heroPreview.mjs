const imageTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml']);
const imagePath = /\.(?:png|jpe?g|gif|webp|avif|svg)$/i;

/** Read only the chosen image from a stored article; never return article copy
 * or its sharing token to the browser when rendering a library card. */
export function heroSource(body) {
  let doc;
  try { doc = JSON.parse(body); } catch { return null; }
  if (!doc || typeof doc !== 'object' || !doc.assets || typeof doc.assets !== 'object' || Array.isArray(doc.assets)) return null;
  const ids = [doc.hero?.assetId, doc.cover?.assetId];
  if (typeof doc.templateId === 'string' && doc.templateId.startsWith('gallery-') && Array.isArray(doc.blocks)) {
    const figures = doc.blocks.filter(block => block?.type === 'figure');
    // Gallery 2's first figure is the central photograph; the other galleries
    // use their second figure for the image spanning the two-page fold.
    ids.push(figures[doc.templateId === 'gallery-2' ? 0 : 1]?.assetId, ...figures.map(block => block.assetId));
  }
  if (typeof doc.templateId === 'string' && doc.templateId.startsWith('news-') && Array.isArray(doc.news?.stories)) {
    ids.push(...doc.news.stories.map(story => story?.assetId));
  }
  for (const id of ids) {
    if (typeof id !== 'string' || !Object.hasOwn(doc.assets, id)) continue;
    const source = doc.assets[id]?.src;
    if (typeof source === 'string' && source.trim()) return source.trim();
  }
  return null;
}

/** Embedded images stay on this authenticated origin. Legacy web image URLs
 * redirect in the browser: the server never makes an external image request. */
export function imageResponse(source, origin) {
  if (typeof source !== 'string') return null;
  const embedded = /^data:(image\/[a-z0-9.+-]+)((?:;[^,]*)?),([\s\S]*)$/i.exec(source);
  if (embedded) {
    const type = embedded[1].toLowerCase();
    const parameters = embedded[2].toLowerCase().split(';').filter(Boolean);
    if (!imageTypes.has(type) || parameters.some(value => !['base64', 'utf8', 'charset=utf-8'].includes(value))) return null;
    const encoded = embedded[3];
    let bytes;
    try {
      if (parameters.includes('base64')) {
        if (!/^[a-z0-9+/]*={0,2}$/i.test(encoded) || encoded.length % 4 === 1) return null;
        bytes = Buffer.from(encoded, 'base64');
      } else {
        bytes = Buffer.from(decodeURIComponent(encoded), 'utf8');
      }
    } catch { return null; }
    return bytes.length ? { type, bytes } : null;
  }
  let target;
  try { target = new URL(source, origin); } catch { return null; }
  if (target.username || target.password || !imagePath.test(target.pathname)) return null;
  const sameOrigin = target.origin === new URL(origin).origin;
  if (!(target.protocol === 'https:' || sameOrigin && target.protocol === 'http:')) return null;
  // An image preview may use a public asset, never another authenticated API.
  if (sameOrigin && /(?:^|\/)api\//i.test(target.pathname)) return null;
  return { location: target.href };
}
