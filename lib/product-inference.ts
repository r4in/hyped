import type { ProductDetails } from './product-details';

const brands: [string,RegExp][] = [
  ['Jordan',/\b(?:air )?jordan\b/i],['Nike',/\bnike\b/i],['adidas',/\badidas\b/i],
  ['New Balance',/\bnew balance\b/i],['ASICS',/\basics\b/i],['Converse',/\bconverse\b/i],
  ['Vans',/\bvans\b/i],['Puma',/\bpuma\b/i],['Reebok',/\breebok\b/i],['Salomon',/\bsalomon\b/i],
  ['Stüssy',/\bst[uü]ssy\b/i],['Anti Social Social Club',/\banti social social club\b/i],
  ['Carhartt',/\bcarhartt\b/i],['Dickies',/\bdickies\b/i],['Supreme',/\bsupreme\b/i],
  ['The North Face',/\bthe north face\b/i],['Patagonia',/\bpatagonia\b/i],
  ['Fear of God',/\bfear of god\b/i],['Neighborhood',/\bneighborhood\b/i],
];
const garment=/\b(?:tee|t-shirt|hoodie|sweatshirt|crewneck|sweater|jacket|coat|parka|shorts|pants|trousers|jeans|sneakers?|shoes?|trainers?|runner|cap|snapback|boot)\b/i;

export function narrativeProductName(text: string): string {
  const start=text.trim().replace(/^the\s+(?!north face\b)/i,'');
  // Stop at the opening sentence's descriptive predicate, keeping collaboration
  // names intact. Never consume a later sentence such as "It features ...".
  const match=start.match(/^([^.!?\n]{3,120}?)\s+(?:is|are|was|were|features?|offers?|combines?|delivers?|brings?|returns?|revives?|reimagines?|blends?|showcases?|boasts?|sports?|celebrates?|captures?|pays? (?:tribute|homage)|nods? to|draws? (?:inspiration|on)|comes? (?:in|with)|takes?|channels?|updates?|introduces?|has|have)\b/i);
  const candidate=match?.[1].trim();
  if(!candidate||/^(?:this|that|these|those|it|they|a|an|our|your)\b/i.test(candidate))return '';
  const namedBrand=brands.some(([,pattern])=>pattern.test(candidate));
  if((!/^[A-Z\d]/.test(candidate)&&!namedBrand)||(!garment.test(candidate)&&!namedBrand))return '';
  return candidate;
}

export function enrichProductDetails(input: ProductDetails): ProductDetails {
  const title=input.title.trim()||narrativeProductName(input.description);
  const result={...input,title};
  if(!result.brand.trim()&&title){
    // Infer only from the product name, never people, styling suggestions or background stories.
    const matches=brands.filter(([,pattern])=>pattern.test(title));
    if(matches.length===1)result.brand=matches[0][0];
  }
  return result;
}
