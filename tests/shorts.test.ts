import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Collage } from '../components/outfit-collage';
import imageBounds from '../lib/garment-image-bounds.json';
import { initialItems, defaultPreferences as p, defaultWeather as w, type Item } from '../lib/wardrobe';
import { generate, describe, assess, slot, styles, signature } from '../lib/stylist';
import { fillProductFields, productFields } from '../lib/product-autofill';
import { itemSchema, stateSchema } from '../lib/validation';
import { readWardrobeBackup } from '../lib/wardrobe-transfer';
import type { ProductDetails } from '../lib/product-details';

const pants=initialItems.find(i=>i.category==='pants')!;
const shorts:Item={...pants,id:'test-shorts',name:'Olive chino shorts',category:'shorts'};
const shortWardrobe=initialItems.filter(i=>i.category!=='pants').concat(shorts);
const mixed=[...initialItems,shorts];
function random(){let seed=783;return ()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};}
const details:ProductDetails={title:'',description:'',brand:'',material:'',color:'',sku:'',sourceUrl:'',inputMethod:'pasted',fetchedAt:'2026-10-04T12:00:00.000Z'};

test('shorts replace pants in complete, distinct looks for every style',()=>{
  for(const style of styles){
    const looks=generate(shortWardrobe,{...p,style},w,[],[],[],random());
    assert.equal(looks.length,3);
    assert.equal(new Set(looks.map(l=>signature(l.map(i=>i.id)))).size,3);
    for(const look of looks){
      assert.equal(look.filter(i=>slot(i)==='bottom').length,1);
      assert(look.some(i=>i.id===shorts.id));
      assert(look.some(i=>i.category==='tee'));
      assert(look.some(i=>i.category==='shoes'));
      const story=describe(look,{...p,style});
      assert.notEqual(story.name,'Incomplete rotation');
      assert.match(story.rationale,/olive shorts/);
      assert.match(story.tips[0],/shorts hem/);
      assert.doesNotMatch(story.tips.join(' '),/ankle|stacking|ground/);
    }
  }
});

test('pants and shorts share generation, swapping and lock rules',()=>{
  assert.equal(slot(pants),slot(shorts)); // The swap UI uses this same predicate.
  assert.throws(()=>generate(mixed,p,w,[pants.id,shorts.id]),/one item per outfit slot/);
  assert.throws(()=>generate(shortWardrobe,p,w,[shorts.id,'missing']),/no longer/);
  assert.throws(()=>generate(initialItems.filter(i=>slot(i)!=='bottom'),p,w),/pants or shorts/);
  for(const bottom of [pants,shorts]){
    const first=generate(mixed,p,w,[bottom.id],[],[],random());
    const seen=first.map(l=>signature(l.map(i=>i.id)));
    const next=generate(mixed,p,w,[bottom.id],[],seen,random());
    assert(next.length>0);
    for(const look of [...first,...next])assert.deepEqual(look.filter(i=>slot(i)==='bottom'),[bottom]);
    assert(next.every(l=>!seen.includes(signature(l.map(i=>i.id)))));
  }
});

test('weather favors appropriate coverage but keeps locked or only-owned shorts',()=>{
  const basics=initialItems.filter(i=>['tee','shoes'].includes(i.category)).filter((i,index,all)=>all.findIndex(j=>j.category===i.category)===index);
  const inventory=[...basics,pants,shorts];
  for(const feels of [12,18,26]){
    const weather={...w,feels};
    const looks=generate(inventory,{...p,cap:false},weather,[],[],[],random());
    assert(looks.every(l=>l.filter(i=>slot(i)==='bottom').length===1));
    if(feels===12)assert(looks[0].some(i=>i.id===pants.id));
    if(feels===26)assert(looks[0].some(i=>i.id===shorts.id));
    const locked=generate(shortWardrobe,p,weather,[shorts.id],[],[],random())[0];
    assert(locked.some(i=>i.id===shorts.id));
    const advice=assess(locked,weather,p,[shorts.id]);
    assert.equal(advice.gaps.some(g=>g.includes('Locked shorts conflict')),feels<18);
  }
});

test('autofill recognizes shorts from titles, descriptions and narrative names without confusing sleeves',()=>{
  for(const title of ['Chino shorts','Cargo Shorts','Denim shorts','Running shorts']){
    const result=fillProductFields(pants,{...details,title,description:'Pair with a tee or hoodie.'}).item;
    assert.equal(result.category,'shorts');
    assert.equal(result.id,pants.id);
    assert.equal(result.warmth,pants.warmth);
  }
  assert.equal(productFields({...details,description:'Category: shorts. Relaxed fit.'}).category,'shorts');
  const inferred=productFields({...details,description:'The Coastal Shorts are made for everyday wear.'});
  assert.equal(inferred.name,'Coastal Shorts');
  assert.equal(inferred.category,'shorts');
  for(const title of ['Short sleeve tee','Short-sleeve t-shirt','Shortsleeve tee'])assert.equal(productFields({...details,title}).category,'tee');
  assert.equal(productFields({...details,title:'Classic pants',description:'Also available as shorts.'}).category,'pants');
  assert.equal(productFields({...details,title:'Pants and shorts set'}).category,undefined);
});

test('new shorts and existing pants outfits survive saved state and backup round-trips',()=>{
  const fits=[pants,shorts].map(bottom=>({id:'fit-'+bottom.id,name:bottom.name,items:[initialItems.find(i=>i.category==='tee')!.id,bottom.id,initialItems.find(i=>i.category==='shoes')!.id],createdAt:'2026-10-04T12:00:00Z',favorite:true,worn:['2026-10-04'],style:p.style,weather:w,preferences:p}));
  const state={items:mixed,fits,preferences:p,weather:w,revision:7};
  assert.deepEqual(stateSchema.parse(JSON.parse(JSON.stringify(state))),state);
  assert.deepEqual(readWardrobeBackup(JSON.stringify(state)),state);
  assert.equal(itemSchema.safeParse({...shorts,category:'bottom'}).success,false);
});

test('shorts retain aspect ratio, stay in frame and paint above layers in every collage size',()=>{
  // Use an existing wide image to stress the layout's width constraint.
  const shoe=initialItems.find(i=>i.category==='shoes')!;
  const wideShorts={...shorts,image:shoe.image};
  const bounds=(imageBounds as Record<string,{bounds:number[]}>)[shoe.image].bounds;
  const ratio=bounds[2]/bounds[3];
  const tee=initialItems.find(i=>i.category==='tee')!;
  const hoodie=initialItems.find(i=>i.category==='hoodie')!;
  const outer:Item={...hoodie,id:'test-outerwear',category:'outerwear'};
  for(const layers of [[],[hoodie],[hoodie,outer]])for(const small of [false,true]){
    const markup=renderToStaticMarkup(createElement(Collage,{items:[wideShorts,shoe,...layers,tee],small}));
    const tag=markup.match(/<svg [^>]*data-category="shorts"[^>]*>/)![0];
    const number=(name:string)=>Number(tag.match(new RegExp(`\\b${name}="([^"]+)"`))![1]);
    assert(number('x')+number('width')<=1280);
    assert(number('height')<=340);
    assert(Math.abs(number('width')/number('height')-ratio)<0.0001);
    assert(markup.indexOf('data-category="tee"')<markup.indexOf('data-category="shorts"'));
    for(const layer of layers)assert(markup.indexOf(`data-category="${layer.category}"`)<markup.indexOf('data-category="shorts"'));
  }
});
