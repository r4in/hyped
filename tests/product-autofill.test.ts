import test from 'node:test';
import assert from 'node:assert/strict';
import { fillProductFields, productFields } from '../lib/product-autofill';
import { initialItems } from '../lib/wardrobe';
import type { ProductDetails } from '../lib/product-details';
import { itemSchema } from '../lib/validation';
const details: ProductDetails={title:'BASIC STÜSSY TEE',description:'Relaxed fit shortsleeve teeMidweight 6.5oz cotton jerseyRibbed crewneckStüssy basic logo screenprint at left chest and backUnisexMaterial: 100% cottonImported',brand:'Stussy',material:'',color:'',sku:'1905000-WHIT-M',sourceUrl:'https://ca.stussy.com/products/1905000-basic-stussy-tee-white',fetchedAt:new Date().toISOString()};
const tee=initialItems.find(i=>i.id==='figma-602-113')!;
test('Stüssy details automatically populate supported fields and preserve unknowns',()=>{
  const {item,filled}=fillProductFields(tee,details);
  assert.equal(item.name,'BASIC STÜSSY TEE');assert.equal(item.brand,'Stussy');assert.equal(itemSchema.parse(item).brand,'Stussy');assert.equal(item.category,'tee');
  assert.equal(item.silhouette,'relaxed');assert.equal(item.graphic,'logo');assert.equal(item.material,'100% cotton');
  assert.match(item.notes,/tee\. Midweight/);assert.match(item.notes,/100% cotton/);
  assert.equal(item.texture,tee.texture);assert.equal(item.color,tee.color);assert.equal(item.accent,tee.accent);
  assert.equal(item.warmth,tee.warmth);assert.equal(item.waterproof,tee.waterproof);assert.equal(item.insulated,tee.insulated);assert.equal(item.estimated,tee.estimated);
  assert.equal(item.image,tee.image);assert(filled.includes('fit'));assert(itemSchema.safeParse(item).success);
});
test('explicit dropdown values map to existing options and uncertain values stay unchanged',()=>{
  const fields=productFields({...details,title:'White oversized hoodie',description:'Logo-free. Garment-washed. Accent color: blue. Material: 80% organic cotton / 20% recycled polyester.',color:'white'});
  assert.equal(fields.category,'hoodie');assert.equal(fields.color,'white');assert.equal(fields.accent,'blue');
  assert.equal(fields.silhouette,'oversized');assert.equal(fields.graphic,'quiet');assert.equal(fields.texture,'washed');
  assert.equal(fields.material,'80% organic cotton / 20% recycled polyester');
  const uncertain=productFields({...details,title:'Special edition',description:'Not oversized. A ribbed neckline. Cotton lining.',color:'green'});
  assert.equal(uncertain.color,undefined);assert.equal(uncertain.silhouette,undefined);assert.equal(uncertain.texture,undefined);assert.equal(uncertain.material,undefined);
});
test('empty or ambiguous information does not clear existing fields',()=>{
  const blank={...details,title:'',brand:'',description:'',material:'',color:''};
  const {item}=fillProductFields(tee,blank);
  assert.deepEqual({...item,productDetails:undefined},{...tee,productDetails:undefined});
  const fields=productFields({...blank,title:'Black and white tee',description:'Regular fit or relaxed fit options.'});
  assert.equal(fields.color,undefined);assert.equal(fields.silhouette,undefined);
});
test('edits made during fetching survive while other supported fields populate',()=>{
  const modified={...tee,name:'My favorite tee',brand:'My label',notes:'Gift from a friend',silhouette:'slim'};
  const {item,filled}=fillProductFields(modified,details,tee);
  assert.equal(item.name,modified.name);assert.equal(item.brand,modified.brand);assert.equal(item.notes,modified.notes);assert.equal(item.silhouette,modified.silhouette);
  assert.equal(item.material,'100% cotton');assert(!filled.includes('name'));
  const again=fillProductFields(item,details).item;
  assert.equal(again.notes,fillProductFields(again,details).item.notes);
});
