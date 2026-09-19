import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProductDetails, productUrl } from '../lib/product-details';
import { fetchProduct, publicAddress } from '../lib/fetch-product';
import { itemSchema } from '../lib/validation';
import { initialItems } from '../lib/wardrobe';

const url='https://shop.example.com/products/tee';
const html=`<script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Studio &amp; Print Tee","description":"<p>Relaxed cotton tee.</p>","brand":{"name":"Example"},"material":"100% cotton","color":"White","sku":"T-01"}]}</script>`;
test('structured product facts are extracted as bounded plain text',()=>{
  const details=extractProductDetails(html,url);
  assert.equal(details.title,'Studio & Print Tee');assert.equal(details.description,'Relaxed cotton tee.');
  assert.equal(details.brand,'Example');assert.equal(details.material,'100% cotton');assert.equal(details.sku,'T-01');
  assert.equal(details.sourceUrl,url);
});
test('metadata fallback works without inventing fabric or brand',()=>{
  const details=extractProductDetails(`<meta content="A useful shirt" property="og:title"><meta name="description" content="A roomy &amp; soft tee.">`,url);
  assert.equal(details.title,'A useful shirt');assert.equal(details.material,'');assert.equal(details.brand,'');
  assert.throws(()=>extractProductDetails('<html></html>',url),/readable/);
});
test('ambiguous product lists do not attribute facts from a recommended item',()=>{
  const details=extractProductDetails('<title>Product page</title><script type="application/ld+json">[{"@type":"Product","name":"Wrong 1","material":"Cotton"},{"@type":"Product","name":"Wrong 2","material":"Wool"}]</script>',url);
  assert.equal(details.material,'');assert.equal(details.title,'Product page');
});
test('legacy items and optional URLs persist without changing protection flags',()=>{
  assert(itemSchema.safeParse(initialItems[0]).success);
  const item=itemSchema.parse({...initialItems[0],productUrl:url,productDetails:extractProductDetails(html,url)});
  assert.equal(item.productUrl,url);assert.equal(item.productDetails?.material,'100% cotton');assert.equal(item.waterproof,false);assert.equal(item.insulated,false);
  assert(!itemSchema.safeParse({...item,productUrl:'javascript:alert(1)'}).success);
});
test('unsafe URLs and private network destinations are rejected',()=>{
  for(const candidate of ['http://shop.example.com','https://localhost','https://127.0.0.1','https://2130706433','https://[::1]','https://shop.internal','https://u:p@shop.example.com','https://shop.example.com:8443'])assert.throws(()=>productUrl(candidate));
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.16.0.1','100.64.0.1','::1','fd00::1','::ffff:127.0.0.1'])assert(!publicAddress(ip));
  assert(publicAddress('93.184.216.34'));assert(publicAddress('2606:4700:4700::1111'));
});
test('fetch validates DNS and every redirect without forwarding credentials',async()=>{
  const fetcher=(async (input:RequestInfo|URL,init?:RequestInit)=>{
    const target=String(input);
    if(target.startsWith('https://cloudflare-dns.com/'))return Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]});
    assert.equal(init?.redirect,'manual');assert.equal(init?.credentials,'omit');
    assert.equal(new Headers(init?.headers).get('User-Agent'),'Hyope/1.0 (product reference reader)');
    return new Response('',{status:302,headers:{Location:'https://127.0.0.1/private'}});
  }) as typeof fetch;
  await assert.rejects(fetchProduct(url,'hyope.example.com',fetcher),/public HTTPS/);
  const privateDns=(async()=>Response.json({Status:0,Answer:[{type:1,data:'10.0.0.1'}]})) as typeof fetch;
  await assert.rejects(fetchProduct(url,'hyope.example.com',privateDns),/public product/);
});
test('retailer failures explain missing pages, request limits and server errors',async()=>{
  for(const [status,message] of [[404,/wasn’t found/],[403,/limiting automatic requests/],[429,/limiting automatic requests/],[503,/error \(503\)/]] as const){
    const fetcher=(async(input:RequestInfo|URL)=>String(input).startsWith('https://cloudflare-dns.com/')?Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}):new Response('unavailable',{status})) as typeof fetch;
    await assert.rejects(fetchProduct(url,'hyope.example.com',fetcher),message);
  }
});
test('public HTML is read and non-HTML or excessive responses fail clearly',async()=>{
  const fetcher=(async(input:RequestInfo|URL)=>String(input).startsWith('https://cloudflare-dns.com/')?Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}):new Response(html,{headers:{'Content-Type':'text/html'}})) as typeof fetch;
  assert.equal((await fetchProduct(url,'hyope.example.com',fetcher)).title,'Studio & Print Tee');
  const oversized=(async(input:RequestInfo|URL)=>String(input).startsWith('https://cloudflare-dns.com/')?Response.json({Status:0,Answer:[{type:1,data:'93.184.216.34'}]}):new Response('x'.repeat(1500001),{headers:{'Content-Type':'text/html'}})) as typeof fetch;
  await assert.rejects(fetchProduct(url,'hyope.example.com',oversized),/too large/);
});
