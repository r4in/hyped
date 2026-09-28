'use client';
import { useEffect,useState } from 'react';
import { readWardrobeBackup,sameWardrobe,type WardrobeBackup } from '@/lib/wardrobe-transfer';
import { stateSchema } from '@/lib/validation';
import { readApiResponse,signInMessage } from '@/lib/api-client';

async function loadSaved(){
  const response=await fetch('/api/state',{cache:'no-store'});
  const data=await readApiResponse(response);
  return stateSchema.parse(data);
}
export function WardrobeTransfer(){
  const [current,setCurrent]=useState<WardrobeBackup|null>(null);
  const [incoming,setIncoming]=useState<WardrobeBackup|null>(null);
  const [backedUp,setBackedUp]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{loadSaved().then(setCurrent).catch(e=>setError(e.message));},[]);
  async function downloadBackup(){
    setError('');setBusy(true);
    try{
      const saved=await loadSaved();setCurrent(saved);
      const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`hyope-wardrobe-${location.hostname}-${Date.now()}.json`;
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      setBackedUp(true);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function selectBackup(file?:File){
    setError('');setMessage('');setIncoming(null);
    if(!file)return;
    try{
      if(file.size>2000000)throw Error('Choose a wardrobe backup under 2 MB.');
      setIncoming(readWardrobeBackup(await file.text()));
    }catch(e){setError((e as Error).message);}
  }
  async function importBackup(){
    if(!incoming||!current||!backedUp)return;
    setBusy(true);setError('');setMessage('');
    try{
      const next={...incoming,revision:current.revision};
      const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
      await readApiResponse(response);
      const verified=await loadSaved();
      if(!sameWardrobe(next,verified))throw Error('Your wardrobe was saved, but verification could not finish. Keep your backup and reload to check it.');
      setCurrent(verified);setIncoming(null);setBackedUp(false);
      setMessage(`Imported and verified ${verified.items.length} pieces, ${verified.fits.length} saved outfits, and your preferences.`);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main style={{maxWidth:760,margin:'0 auto',padding:'48px 24px'}}>
    <a className="source-link" href="/">← Back to your wardrobe</a>
    <div className="page-heading"><h1>Keep your <em>rotation.</em></h1></div>
    <p>Back up your saved pieces, outfit history, and preferences, or move them between your local and published wardrobe.</p>
    {current?<p>{current.items.length} pieces and {current.fits.length} saved outfits on this site.</p>:<p>Loading your saved wardrobe…</p>}
    <section style={{padding:'24px 0',borderBottom:'1px solid var(--line)'}}>
      <h2>1. Keep a backup</h2>
      <p>Download the current wardrobe before importing. You can restore it using the same file.</p>
      <button className="outline-button" onClick={downloadBackup} disabled={!current||busy}>Download current backup</button>
      {backedUp&&<p role="status">Backup download started. Keep the file before replacing this wardrobe.</p>}
    </section>
    <section style={{padding:'24px 0'}}>
      <h2>2. Import your wardrobe</h2>
      <label className="form-label">Choose wardrobe backup<input type="file" accept="application/json,.json" disabled={busy} onChange={e=>void selectBackup(e.target.files?.[0])}/></label>
      {incoming&&<><p>Ready to import {incoming.items.length} pieces and {incoming.fits.length} saved outfits.</p>
        <p>This replaces this account’s wardrobe, saved outfits, and preferences with the backup.</p>
        <button className="primary" disabled={!backedUp||busy||!current} onClick={importBackup}>{busy?'Importing…':'Import wardrobe'}</button>
        {!backedUp&&<p>Download your current backup first.</p>}</>}
    </section>
    {error&&<p className="notice error" role="alert">{error} {error===signInMessage&&<a href="/signin-with-chatgpt?return_to=/transfer" target="_top">Sign in again</a>}</p>}
    {message&&<p className="notice" role="status">{message}</p>}
  </main>;
}
