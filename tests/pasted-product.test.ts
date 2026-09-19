import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePastedProduct} from '../lib/pasted-product';
import {fillProductFields} from '../lib/product-autofill';
import {initialItems} from '../lib/wardrobe';
import {itemSchema} from '../lib/validation';
const url='https://stockx.com/air-jordan-1-retro-low-og-sp-travis-scott-reverse-mocha';
const text=`Jordan 1 Retro Low OG SP
Travis Scott Reverse Mocha
Product Details
Brand
Jordan
Style
DM7866-162
Colorway
SAIL/UNIVERSITY RED-RIDGEROCK
Product Description
Low-top sneakers with suede and leather panels.
Related products
A completely different hoodie`;
test('marketplace text supports split titles and labels on separate lines',()=>{
 const d=parsePastedProduct(text,url);
 assert.equal(d.title,'Jordan 1 Retro Low OG SP Travis Scott Reverse Mocha');
 assert.equal(d.brand,'Jordan');assert.equal(d.sku,'DM7866-162');assert.equal(d.color,'SAIL/UNIVERSITY RED-RIDGEROCK');
 assert(!d.description.includes('different hoodie'));assert.equal(d.inputMethod,'pasted');assert.equal(d.sourceUrl,url);
 const item=fillProductFields(initialItems.find(i=>i.category==='shoes')!,d).item;
 assert.equal(item.silhouette,'low-top');assert.equal(item.category,'shoes');assert.equal(item.brand,'Jordan');
 assert.equal(item.color,initialItems.find(i=>i.category==='shoes')!.color);
 assert.equal(itemSchema.parse(item).productDetails?.inputMethod,'pasted');
});
test('inline labels fill supported values without inventing unlabeled brand or material',()=>{
 const d=parsePastedProduct('Name: Everyday tee\nBrand: Studio\nMaterial: 100% cotton\nColor: white\nCategory: tee\nFit: relaxed\nDescription: A smooth fabric with a small logo.',url);
 const item=fillProductFields(initialItems[0],d).item;
 assert.equal(item.name,'Everyday tee');assert.equal(item.material,'100% cotton');assert.equal(item.color,'white');assert.equal(item.silhouette,'relaxed');assert.equal(item.graphic,'logo');
 const uncertain=parsePastedProduct('Mystery sneaker\nA comfortable shoe.',url);
 assert.equal(uncertain.brand,'');assert.equal(uncertain.material,'');
});
test('pasting rejects empty/oversized text and invalid source links, bounds saved fields',()=>{
 for(const raw of ['', '   ', 'Product Details'])assert.throws(()=>parsePastedProduct(raw,url),/Paste/);
 assert.throws(()=>parsePastedProduct('x'.repeat(12001),url),/12,000/);
 assert.throws(()=>parsePastedProduct(text,'javascript:alert(1)'),/HTTPS/);
 const d=parsePastedProduct('Title: '+ 'A'.repeat(200)+'\nDescription: '+'b'.repeat(1000),url);
 assert.equal(d.title.length,120);assert.equal(d.description.length,500);
 assert(itemSchema.safeParse({...initialItems[0],productUrl:url,productDetails:d}).success);
});
test('pasted markup is never retained as executable content and old details remain compatible',()=>{
 const d=parsePastedProduct('<script>alert(1)</script>\nName: <b>Plain tee</b>\nDescription: Soft cotton.',url);
 assert.equal(d.title,'Plain tee');assert(!d.description.includes('alert'));
 const item=fillProductFields(initialItems[0],d).item;
 assert.equal(item.waterproof,false);assert.equal(item.insulated,false);assert.equal(item.image,initialItems[0].image);
 const {inputMethod,...legacy}=d;
 assert.equal(inputMethod,'pasted');assert(itemSchema.safeParse({...item,productDetails:legacy}).success);
});
test('screenshots can fill and persist details without an invented source URL',()=>{
 const d=parsePastedProduct('Name: Studio Hoodie\nBrand: Studio\nMaterial: 100% cotton\nFit: relaxed','', 'screenshot');
 assert.equal(d.sourceUrl,'');assert.equal(d.inputMethod,'screenshot');
 const item=fillProductFields(initialItems[0],d).item;
 assert.equal(item.name,'Studio Hoodie');assert.equal(item.brand,'Studio');assert.equal(item.silhouette,'relaxed');
 assert(itemSchema.safeParse(item).success);
 assert(!itemSchema.safeParse({...item,productDetails:{...d,inputMethod:'page'}}).success);
});
const chicagoDescription='The Air Jordan 1 Retro Low OG Chicago (2025) revives one of the most recognizable colorways in sneaker history. Featuring varsity red, black, and summit white, this version captures the look that helped launch sneaker culture in 1985. The leather upper and classic color blocking stay true to the original design, while the low-cut shape gives it an easy, everyday feel. The Chicago story runs deep. Worn by Michael Jordan during his early years with the Bulls.';
test('paragraph-only product descriptions fill the named product, brand and stated shoe attributes',()=>{
 const d=parsePastedProduct('Colorway\nVarsity Red/Black/Summit White\nStyle\nHQ6998-600\nProduct Description\n'+chicagoDescription,'');
 assert.equal(d.title,'Air Jordan 1 Retro Low OG Chicago (2025)');assert.equal(d.brand,'Jordan');
 assert.equal(d.material,'leather (upper)');assert.equal(d.sku,'HQ6998-600');
 const shoe={...initialItems.find(i=>i.category==='shoes')!,color:'white',accent:'red'};
 const item=fillProductFields(shoe,d).item;
 assert.equal(item.name,d.title);assert.equal(item.brand,'Jordan');assert.equal(item.category,'shoes');assert.equal(item.silhouette,'low-top');
 assert.equal(item.material,'leather (upper)');assert.equal(item.color,'white');assert.equal(item.accent,'red');
 assert.equal(item.warmth,shoe.warmth);assert.equal(item.waterproof,false);assert.equal(item.insulated,false);
 // References saved before the parser update can also be applied without pasting again.
 const old={...d,title:'',brand:'',material:''};
 const reapplied=fillProductFields(shoe,old).item;
 assert.equal(reapplied.name,d.title);assert.equal(reapplied.productDetails?.brand,'Jordan');
});
test('other brands and short prose work, but unrelated brand mentions do not become the garment brand',()=>{
 const d=parsePastedProduct('The adidas Campus 00s sneakers feature a suede upper and low-cut shape.','');
 assert.equal(d.title,'adidas Campus 00s sneakers');assert.equal(d.brand,'adidas');
 const tee=parsePastedProduct('The Stüssy Basic Tee offers a relaxed fit and a small logo.','');
 assert.equal(tee.title,'Stüssy Basic Tee');assert.equal(fillProductFields(initialItems[0],tee).item.silhouette,'relaxed');
 const generic=parsePastedProduct('Description: This sneaker is inspired by Michael Jordan and pairs well with a Nike hoodie.','');
 assert.equal(generic.title,'');assert.equal(generic.brand,'');
 const explicit=parsePastedProduct('Name: Custom Studio Tee\nBrand: My Studio\nDescription: Inspired by Nike.','');
 assert.equal(explicit.brand,'My Studio');
});
test('low-cut necklines and absent leather do not become shoe specifications',()=>{
 const d=parsePastedProduct('Name: Studio Tee\nDescription: A low-cut neckline. No leather upper.','');
 assert.equal(d.material,'');
 const item=fillProductFields(initialItems.find(i=>i.category==='tee')!,d).item;
 assert.equal(item.silhouette,'regular');
});
