import type { ProductDetails } from './product-details';
import type { Category, Item } from './wardrobe';
import { enrichProductDetails } from './product-inference';

const colorNames = ['black','white','cream','grey','navy','blue','olive','red','pink','brown'];
function color(value: string) {
  const normalized = value.toLowerCase().replace(/\bgray\b/g,'grey');
  const matches = colorNames.filter(name => new RegExp(`\\b${name}\\b`).test(normalized));
  return matches.length === 1 ? matches[0] : undefined;
}

// Product descriptions sometimes arrive without separators between HTML blocks.
export function productDescription(value: string) {
  return value.replace(/([a-z])([A-Z])/g,'$1. $2').replace(/\s+/g,' ').trim().slice(0,500);
}

export function productMaterial(details: ProductDetails) {
  if (details.material.trim()) return details.material.trim().slice(0,500);
  const description = productDescription(details.description);
  // Copy a labelled composition only; fabric mentions alone may refer to a trim or lining.
  const composition = description.match(/\b(?:material|composition|fabric)\s*:\s*((?:\d{1,3}(?:\.\d+)?\s*%\s*(?:(?:organic|recycled)\s+)?(?:cotton|polyester|elastane|spandex|nylon|wool|linen|viscose|rayon|silk|acrylic|polyamide|lyocell|hemp)(?:\s*[,/+&]\s*|\s+(?:and\s+)?(?=\d)|\s*))+)/i);
  if(composition)return composition[1].trim().replace(/[,/+&]\s*$/,'');
  // Preserve the stated scope: an upper's material is not the entire shoe's composition.
  const upper=description.match(/\b((?:(?:full[- ]grain|genuine|synthetic|faux|vegan)\s+)?(?:leather|suede|canvas|mesh|nylon)(?:\s+(?:and|with)\s+(?:leather|suede|canvas|mesh|nylon))?)\s+upper\b/i);
  if(upper&&!/\b(?:not|without|no)\s+(?:a\s+)?$/i.test(description.slice(0,upper.index)))return `${upper[1]} (upper)`;
  return '';
}

function uniqueMatch<T extends string>(text: string, rules: [T,RegExp][]): T | undefined {
  const matches = rules.filter(([,pattern]) => pattern.test(text)).map(([value]) => value);
  return matches.length === 1 ? matches[0] : undefined;
}

export function productFields(input: ProductDetails): Partial<Item> {
  const details=enrichProductDetails(input);
  const fields: Partial<Item> = {};
  const description = productDescription(details.description);
  const text = `${details.title}. ${description}`;
  if (details.title.trim()) fields.name = details.title.trim().slice(0,120);
  if (description) fields.notes = description;
  if (details.brand.trim()) fields.brand = details.brand.trim().slice(0,120);
  const material = productMaterial(details);
  if (material) fields.material = material;
  const categories: [Category,RegExp][] = [
    ['shorts',/\bshorts\b/i], ['tee',/\b(?:tee|t-shirt|t shirt)\b/i], ['pants',/\b(?:pants|trousers|jeans)\b/i],
    ['shoes',/\b(?:sneakers?|shoes?|trainers?)\b/i], ['cap',/\b(?:snapback|baseball cap|cap)\b/i],
    ['hoodie',/\b(?:hoodie|hooded sweatshirt)\b/i], ['crewneck',/\b(?:crewneck sweatshirt|crewneck sweater|sweatshirt|sweater)\b/i],
    ['outerwear',/\b(?:jacket|coat|parka)\b/i],
  ];
  // Prefer the product title so suggestions about other garments do not change category.
  const category = uniqueMatch(details.title,categories) || uniqueMatch(description,categories);
  if (category) fields.category = category;
  // A multi-color marketplace colorway does not identify its dominant color.
  const explicitColor = details.color.trim().toLowerCase().replace(/\bgray\b/g,'grey');
  const mainColor = explicitColor ? (colorNames.includes(explicitColor) ? explicitColor : undefined) : color(details.title);
  if (mainColor) fields.color = mainColor;
  const accent = description.match(/\b(?:accent colo[u]?r|contrast colo[u]?r)\s*:\s*([a-z]+)/i);
  const accentColor = accent && color(accent[1]);
  if (accentColor) fields.accent = accentColor;
  const silhouette = uniqueMatch(text,[
    ['regular',/\b(?:regular|standard) fit\b/i], ['relaxed',/\b(?:relaxed|loose) fit\b/i],
    ['oversized',/\boversized\b/i], ['tapered',/\btapered (?:fit|leg|cut)\b/i],
    ['slim',/\bslim (?:fit|cut)\b/i], ['structured',/\bstructured (?:cap|crown|fit)\b/i],
    ['low-top',category==='shoes'?/\blow[- ](?:tops?|cut)\b/i:/\blow[- ]tops?\b/i], ['high-top',category==='shoes'?/\bhigh[- ](?:tops?|cut)\b/i:/\bhigh[- ]tops?\b/i],
  ]);
  // Avoid turning an explicitly negated fit into an assertion.
  if (silhouette && !/\b(?:not|non)[ -](?:a |an )?(?:regular|standard|relaxed|loose|oversized|tapered|slim|structured|low.top|high.top)\b/i.test(text)) fields.silhouette = silhouette;
  if (/\b(?:no (?:logos?|graphics?)|(?:logo|graphic)[- ]free|unbranded)\b/i.test(text)) fields.graphic = 'quiet';
  else if (/\b(?:all[- ]over (?:print|graphic)|oversized graphic|large graphic)\b/i.test(text)) fields.graphic = 'statement';
  else if (/\blogo\b/i.test(text)) fields.graphic = 'logo';
  const texture = uniqueMatch(text,[
    ['washed',/\b(?:garment[- ]washed|acid[- ]washed|stone[- ]washed|washed finish)\b/i],
    ['paneled',/\b(?:paneled|panelled) (?:construction|design|upper)\b/i],
    ['ribbed',/\b(?:all[- ]over ribbed|ribbed (?:fabric|knit|body))\b/i],
    ['textured',/\b(?:textured (?:fabric|finish|knit)|waffle[- ]knit)\b/i],
    ['smooth',/\bsmooth (?:fabric|finish|texture)\b/i],
  ]);
  if (texture) fields.texture = texture;
  // Warmth and protection require review; fabric weight is not a thermal rating.
  return fields;
}

const fieldLabels: Partial<Record<keyof Item,string>> = {name:'name',brand:'brand',notes:'notes',material:'material',category:'category',color:'main color',accent:'accent color',silhouette:'fit',graphic:'graphics',texture:'texture'};
export function fillProductFields(item: Item, details: ProductDetails, startedFrom = item) {
  const enriched=enrichProductDetails(details);
  const fields = productFields(enriched);
  const next = {...item,productDetails:{...enriched,material:fields.material||enriched.material}};
  const filled: string[] = [];
  for (const key of Object.keys(fields) as (keyof Item)[]) {
    // Do not overwrite a field the user edited while the request was running.
    if (item[key] !== startedFrom[key]) continue;
    Object.assign(next,{[key]:fields[key]});
    filled.push(fieldLabels[key]!);
  }
  return {item:next,filled};
}
