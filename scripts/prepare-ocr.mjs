// Self-host OCR assets so screenshots never leave the browser for recognition.
import { mkdir, copyFile, readdir } from 'node:fs/promises';
const root = new URL('../',import.meta.url);
const dest = new URL('public/ocr/',root);
await mkdir(dest,{recursive:true});
const core = new URL('node_modules/tesseract.js-core/',root);
for(const name of await readdir(core)) {
  if(name.endsWith('.wasm.js')) await copyFile(new URL(name,core),new URL(name,dest));
}
await copyFile(new URL('node_modules/tesseract.js/dist/worker.min.js',root),new URL('worker.min.js',dest));
await copyFile(new URL('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',root),new URL('eng.traineddata.gz',dest));
await copyFile(new URL('node_modules/tesseract.js/LICENSE.md',root),new URL('LICENSE-tesseract.txt',dest));
await copyFile(new URL('LICENSE',core),new URL('LICENSE-core.txt',dest));
