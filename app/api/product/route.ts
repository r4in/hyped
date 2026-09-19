import { identity, failure } from '@/lib/server';
import { fetchProduct } from '@/lib/fetch-product';

export async function POST(request: Request) {
  try { await identity(request); } catch(e) { return failure(e); }
  if(Number(request.headers.get('content-length'))>4096) return Response.json({error:'Product URL is too long.'},{status:400});
  try {
    const body=await request.text();
    if(body.length>4096)throw Error('Product URL is too long.');
    const input=JSON.parse(body);
    if(typeof input?.url!=='string')throw Error('Enter a product URL.');
    return Response.json(await fetchProduct(input.url,new URL(request.url).hostname),{headers:{'Cache-Control':'no-store'}});
  } catch(e) {
    return Response.json({error:e instanceof Error && e.name==='Error'?e.message:'Couldn’t read this page right now. You can still save its URL.'},{status:400});
  }
}
