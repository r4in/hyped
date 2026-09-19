export type ProductDetails = { inputMethod?: 'page' | 'pasted'; title: string; description: string; brand: string; material: string; color: string; sku: string; sourceUrl: string; fetchedAt: string };

export function productUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw Error('Enter a complete product URL starting with https://.'); }
  const host = url.hostname.toLowerCase();
  if (value.length > 2048 || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !host.includes('.') || /[:\[\]]/.test(host) || /^[\d.]+$/.test(host) || /(?:^|\.)(localhost|local|internal|test|invalid|lan|home|onion)$/.test(host) || host.endsWith('.')) {
    throw Error('Use a public HTTPS product page URL.');
  }
  url.hash = '';
  return url;
}

function plain(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[\da-f]+|\d+);/gi, entity => {
    const named: Record<string,string> = { '&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' ' };
    if (named[entity]) return named[entity];
    const n = entity.startsWith('&#x') ? parseInt(entity.slice(3),16) : parseInt(entity.slice(2),10);
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  }).replace(/\s+/g, ' ').trim().slice(0,max);
}

export function extractProductDetails(html: string, sourceUrl: string): ProductDetails {
  const candidates: Record<string,unknown>[] = [];
  function visit(value: unknown, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12) return;
    if (Array.isArray(value)) { value.slice(0,100).forEach(v => visit(v,depth+1)); return; }
    const object = value as Record<string,unknown>;
    const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
    if (types.some(t => typeof t === 'string' && /(?:^|\/)Product$/.test(t))) candidates.push(object);
    // Only visit document-level structured graphs; avoid unrelated recommendation lists.
    if (object['@graph']) visit(object['@graph'],depth+1);
    if (object.mainEntity) visit(object.mainEntity,depth+1);
  }
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Some shops emit invalid JSON-LD. */ }
  }
  const product = candidates.find(p => p.url === sourceUrl) || (candidates.length === 1 ? candidates[0] : undefined);
  const meta: Record<string,string> = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes: Record<string,string> = {};
    for (const a of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attributes[a[1].toLowerCase()] = a[2] ?? a[3];
    const key = attributes.property || attributes.name;
    if (key && attributes.content) meta[key.toLowerCase()] = attributes.content;
  }
  const brand = product?.brand;
  const properties = Array.isArray(product?.additionalProperty) ? product.additionalProperty : [];
  const material = product?.material || properties.find(p => p && typeof p === 'object' && /^(material|fabric|composition)$/i.test(String(p.name)))?.value;
  const result = {
    title: plain(product?.name || meta['og:title'] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],120),
    description: plain(product?.description || meta['og:description'] || meta.description),
    brand: plain(typeof brand === 'object' && brand ? (brand as {name?:unknown}).name : brand,120),
    material: plain(Array.isArray(material) ? material.join(', ') : material),
    color: plain(product?.color,120), sku: plain(product?.sku,120), sourceUrl, fetchedAt: new Date().toISOString(),
  };
  if (!result.title && !result.description && !result.material) throw Error('This page doesn’t expose readable product details. You can still save its URL.');
  if (/^(access denied|just a moment|attention required|robot check)/i.test(result.title)) throw Error('This shop blocks automatic reading. You can still save the link and enter details yourself.');
  return result;
}
