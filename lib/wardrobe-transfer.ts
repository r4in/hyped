import { stateSchema } from './validation';
import type { z } from 'zod';

export type WardrobeBackup = z.infer<typeof stateSchema>;
export function readWardrobeBackup(text: string): WardrobeBackup {
  if(new TextEncoder().encode(text).length>2000000)throw Error('Choose a wardrobe backup under 2 MB.');
  let input:unknown;
  try{input=JSON.parse(text);}catch{throw Error('This is not a valid wardrobe backup.');}
  const parsed=stateSchema.safeParse(input);
  if(!parsed.success)throw Error('This backup contains invalid or incomplete wardrobe details.');
  // Uploaded photos belong to the original account's private photo storage.
  // Do not import references that would silently break on another site.
  if(parsed.data.items.some(item=>!item.image.startsWith('/wardrobe/')))throw Error('This backup includes uploaded photos. Photo transfers are not supported yet; your wardrobe has not changed.');
  return parsed.data;
}

export function sameWardrobe(a: WardrobeBackup,b: WardrobeBackup): boolean {
  const normalize=(s:WardrobeBackup)=>JSON.stringify({...stateSchema.parse(s),revision:0});
  return normalize(a)===normalize(b);
}
