'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { Worker } from 'tesseract.js';

export function ProductScreenshot({disabled,onText,onBusy}:{disabled:boolean;onText:(text:string)=>void;onBusy:(busy:boolean)=>void}) {
  const [reading,setReading]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[preview,setPreview]=useState('');
  const [dragging,setDragging]=useState(false);
  const input=useRef<HTMLInputElement>(null),worker=useRef<Worker|null>(null),generation=useRef(0),imageUrl=useRef('');
  const timeout=useRef<ReturnType<typeof setTimeout>|null>(null);
  const cancelRun=useRef<((reason:Error)=>void)|null>(null);
  useEffect(()=>()=>{generation.current++;cancelRun.current?.(Error('Cancelled'));if(timeout.current)clearTimeout(timeout.current);void worker.current?.terminate();if(imageUrl.current)URL.revokeObjectURL(imageUrl.current);},[]);
  function stop(message='Reading cancelled. Choose a screenshot to try again.') {
    generation.current++;if(timeout.current)clearTimeout(timeout.current);
    cancelRun.current?.(Error('Cancelled'));cancelRun.current=null;
    void worker.current?.terminate();worker.current=null;
    setReading(false);onBusy(false);setStatus(message);
  }
  async function read(file?:File) {
    if(!file||disabled||reading)return;
    setError('');setStatus('');
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8000000){setError('Choose a PNG, JPEG or WebP screenshot under 8 MB.');return;}
    const run=++generation.current;
    const active=()=>generation.current===run;
    if(imageUrl.current)URL.revokeObjectURL(imageUrl.current);
    const url=URL.createObjectURL(file);imageUrl.current=url;setPreview(url);
    setReading(true);onBusy(true);setStatus('Preparing screenshot reader…');
    timeout.current=setTimeout(()=>{if(active())stop('Reading took too long. Try a smaller crop or paste the product text instead.');},120000);
    const cancelled=new Promise<never>((_,reject)=>{cancelRun.current=reject;});
    // Attach immediately, including cancellation while the dynamic import is loading.
    void cancelled.catch(()=>{});
    let localWorker:Worker|undefined;
    try {
      const image=new Image();image.src=url;
      await Promise.race([image.decode(),cancelled]);
      if(!active())return;
      if(image.naturalWidth*image.naturalHeight>20000000)throw Error('This screenshot is too large. Crop it to the product title and details and try again.');
      const {createWorker,PSM}=await Promise.race([import('tesseract.js'),cancelled]);
      if(!active())return;
      let rejectWorker:(reason:Error)=>void=()=>{};
      const failure=new Promise<never>((_,reject)=>{rejectWorker=reject;});
      const initializing=createWorker('eng',1,{
        workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',workerBlobURL:false,
        logger:m=>{if(active())setStatus(m.status==='recognizing text'?`Reading screenshot… ${Math.round(m.progress*100)}%`:'Preparing screenshot reader…');},
        errorHandler:()=>rejectWorker(Error('Couldn’t start the screenshot reader. Try again or paste the text instead.')),
      });
      initializing.then(w=>{if(!active())void w.terminate();}).catch(()=>{});
      localWorker=await Promise.race([initializing,failure,cancelled]);
      if(!active())return;
      worker.current=localWorker;
      await Promise.race([localWorker.setParameters({tessedit_pageseg_mode:PSM.AUTO}),failure,cancelled]);
      const result=await Promise.race([localWorker.recognize(file),failure,cancelled]);
      if(!active())return;
      const text=result.data.text.trim();
      if(!text||!/[a-z]{3}/i.test(text))throw Error('No readable product text was found. Use a clear screenshot of the title and specifications, or paste the text instead.');
      if(text.length>12000)throw Error('There’s too much text in this screenshot. Crop it to the product title, specifications and description.');
      onText(text);setStatus('Text extracted. Review it below, then use the screenshot details.');
    } catch(e) {
      if(active())setError(e instanceof Error?e.message:'Couldn’t read this image. Try a clearer screenshot or paste the text instead.');
    } finally {
      await localWorker?.terminate();
      if(active()){if(timeout.current)clearTimeout(timeout.current);cancelRun.current=null;worker.current=null;setReading(false);onBusy(false);generation.current++;}
    }
  }
  return <div className="product-screenshot">
    <div className={`screenshot-drop${dragging?' dragging':''}`} onDragOver={e=>{e.preventDefault();if(!disabled&&!reading)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(disabled||reading)return;if(e.dataTransfer.files.length!==1){setError('Drop one screenshot at a time.');return;}void read(e.dataTransfer.files[0]);}}>
      <ImagePlus size={22}/><p>Drop a product screenshot here</p>
      <button className="outline-button" type="button" disabled={disabled||reading} onClick={()=>input.current?.click()}>Choose screenshot</button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Product screenshot" hidden onChange={e=>{void read(e.target.files?.[0]);e.target.value='';}}/>
      <p className="product-help">PNG, JPEG or WebP · Up to 8 MB. Include the product title and readable details.</p>
    </div>
    {preview&&<img className="screenshot-preview" src={preview} alt="Selected product screenshot"/>}
    {status&&<p className="product-help" role="status">{status}</p>}
    {reading&&<button type="button" className="text-button" onClick={()=>stop()}>Cancel reading</button>}
    {error&&<p className="notice error" role="alert">{error}</p>}
    <p className="product-help">Text is read on your device. The screenshot isn’t uploaded or used as your garment photo. English text works best.</p>
  </div>;
}
