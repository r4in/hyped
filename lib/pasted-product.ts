import { productUrl, type ProductDetails } from './product-details';
import { productMaterial } from './product-autofill';

const labels: Record<string,string> = {
  name:'title','product name':'title',title:'title',brand:'brand',manufacturer:'brand',
  material:'material',materials:'material',composition:'material',fabric:'material',
  color:'color',colour:'color',colorway:'color',colourway:'color',
  sku:'sku',style:'sku','style code':'sku','product code':'sku',
  description:'description','product description':'description',
  category:'category','product type':'category',fit:'fit',silhouette:'fit',
};
const section = /^(?:product details|product information|details|specifications|product description|description)$/i;
const navigation = /^(?:stockx|home|browse|buy|sell|login|log in|sign in|size|select size|all sizes|size guide|condition|new|verified authentic|retail price|release date)$/i;

/** Read only the text the user supplies. Never execute markup or fetch another URL. */
export function parsePastedProduct(raw: string, source: string, inputMethod: 'pasted' | 'screenshot' = 'pasted'): ProductDetails {
  const sourceUrl = source.trim() ? productUrl(source).href : '';
  if (raw.length > 12000) throw Error('Paste just the product title, specifications and description (up to 12,000 characters).');
  const lines = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean);
  const values: Record<string,string> = {};
  const titleLines: string[] = [], prose: string[] = [];
  let inDetails = false;
  for (let i=0;i<lines.length;i++) {
    const line=lines[i];
    if (/^(?:you may also like|related products|recommended products|reviews|customer reviews)$/i.test(line)) break;
    const inline=line.match(/^([^:]{1,30}):\s*(.*)$/);
    const label=(inline?.[1] || line).toLowerCase();
    const key=labels[label];
    if (key) {
      inDetails=true;
      let value=inline?.[2] || '';
      const next=lines[i+1];
      if (!value && next && !labels[next.toLowerCase()] && !labels[next.split(':')[0].toLowerCase()] && !section.test(next) && !navigation.test(next)) value=lines[++i];
      if (value && !values[key]) values[key]=value;
      continue;
    }
    if (section.test(line)) {inDetails=true;continue;}
    if (navigation.test(line) || /^\$|^\d{4}-\d{2}-\d{2}$/.test(line)) {inDetails=true;continue;}
    if (!inDetails && titleLines.length<2 && line.length<=120 && !/[.!?]$/.test(line)) titleLines.push(line);
    else {inDetails=true;prose.push(line);}
  }
  const title=(values.title || titleLines.join(' ')).slice(0,120);
  const descriptionParts=[values.description,...prose].filter(Boolean);
  // Preserve explicit specs in Notes as well as their individual fields.
  if(values.category) descriptionParts.push(`Category: ${values.category}.`);
  if(values.fit) descriptionParts.push(`${values.fit.replace(/[.]+$/,'')} fit.`);
  if(values.material) descriptionParts.push(`Material: ${values.material}.`);
  if(values.color) descriptionParts.push(`Color: ${values.color}.`);
  const result: ProductDetails = {
    title,description:descriptionParts.join(' ').slice(0,500),brand:(values.brand||'').slice(0,120),
    material:(values.material||'').slice(0,500),color:(values.color||'').slice(0,120),sku:(values.sku||'').slice(0,120),
    sourceUrl,fetchedAt:new Date().toISOString(),inputMethod,
  };
  if (!result.title && !result.description && !result.brand && !result.material && !result.color && !result.sku) throw Error('Paste the product’s title, description or specifications first.');
  if(!result.material) result.material=productMaterial(result);
  return result;
}
