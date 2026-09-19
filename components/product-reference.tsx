'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { productUrl, type ProductDetails } from '@/lib/product-details';
import type { Item } from '@/lib/wardrobe';
import { fillProductFields } from '@/lib/product-autofill';

export function ProductReference({ item, onChange }: { item: Item; onChange: (item: Item) => void }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [filled,setFilled]=useState<string[]>([]);
  const pending=useRef<AbortController|null>(null);
  const latest=useRef(item);latest.current=item;
  useEffect(()=>()=>pending.current?.abort(),[]);
  let validLink='';try{validLink=productUrl(item.productUrl||'').href;}catch{}
  function applyDetails(details: ProductDetails, startedFrom = latest.current, url = latest.current.productUrl){
    const result=fillProductFields(latest.current,details,startedFrom);
    onChange({...result.item,productUrl:url});setFilled(result.filled);
  }
  async function readDetails(){
    setError('');setFilled([]);
    let url:string;try{url=productUrl(item.productUrl||'').href;}catch(e){setError((e as Error).message);return;}
    pending.current?.abort();const controller=new AbortController();pending.current=controller;
    setBusy(true);
    try{
      const response=await fetch('/api/product',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url}),signal:controller.signal});
      const result=await response.json() as ProductDetails & {error?:string};
      if(!response.ok)throw Error(result.error||'Couldn’t read this page. You can still save its URL.');
      if(!controller.signal.aborted&&latest.current.id===item.id&&latest.current.productUrl===item.productUrl)applyDetails(result,item,url);
    }catch(e){if(!controller.signal.aborted)setError((e as Error).message);}
    finally{if(pending.current===controller)setBusy(false);}
  }
  const details=item.productDetails;
  return <section className="product-reference" aria-label="Product reference">
    <label className="form-label" htmlFor="product-url">Product URL <span className="muted">Optional</span></label>
    <div className="product-url-row"><input id="product-url" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://shop.com/products/your-piece" maxLength={2048} value={item.productUrl||''} disabled={busy} onChange={e=>{setError('');setFilled([]);onChange({...item,productUrl:e.target.value,productDetails:undefined});}}/>
      <button className="outline-button" type="button" onClick={readDetails} disabled={busy||!item.productUrl?.trim()}>{busy?<><LoaderCircle className="spin" size={14}/>Reading…</>:'Get details'}</button>
    </div>
    <p className="product-help">Get details to fill the name, notes, material, and matching options from the product page. You can edit them before saving.</p>
    {validLink&&<a className="source-link" href={validLink} target="_blank" rel="noreferrer">Open product page <ArrowUpRight size={13}/></a>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    {details&&<div className="product-preview">
      <p className="micro">FROM THE PRODUCT PAGE</p>
      {details.title&&<h3>{details.title}</h3>}
      {details.description&&<p>{details.description}</p>}
      <dl>{([['Brand',details.brand],['Material',details.material],['Color',details.color],['Product code',details.sku]]).filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <a className="source-link" href={details.sourceUrl} target="_blank" rel="noreferrer">Source <ArrowUpRight size={13}/></a>
      <button type="button" className="text-button" disabled={busy} onClick={()=>applyDetails(details)}>Fill fields from product details</button>
      {filled.length>0&&<p className="product-help" role="status">Filled {filled.join(', ')}. Fields without a clear match are unchanged.</p>}
      <p className="product-help">Check the color and version match your piece. Save piece to keep the link and details.</p>
    </div>}
  </section>;
}
