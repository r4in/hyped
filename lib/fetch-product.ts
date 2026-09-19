import { extractProductDetails, productUrl } from './product-details';

export function publicAddress(ip: string) {
  if (ip.includes(':')) return /^[23][\da-f]{3}:/i.test(ip) && !/^(2001:(db8|0):|2002:)/i.test(ip);
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return false;
  const [a,b] = parts;
  return !(a===0 || a===10 || a===127 || a>=224 || (a===100&&b>=64&&b<=127) || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168||b===0)) || (a===198&&(b===18||b===19||b===51)) || (a===203&&b===0));
}

export async function fetchProduct(raw: string, ownHost: string, fetcher = fetch) {
  const signal = AbortSignal.timeout(15000);
  let url = productUrl(raw);
  for (let hops=0; hops<4; hops++) {
    if (url.hostname === ownHost) throw Error('Enter a retailer’s product page URL.');
    // Resolve each destination, including redirects, using public DNS before fetching.
    const records = await Promise.all(['A','AAAA'].map(async type => {
      const answer = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(url.hostname)}&type=${type}`, { headers:{Accept:'application/dns-json'},signal });
      if (!answer.ok) throw Error('Could not reach this product page. You can still save the URL.');
      const data = await answer.json() as { Status:number; Answer?:{type:number;data:string}[] };
      if (data.Status !== 0) throw Error('Could not find this product page. Check the URL.');
      return (data.Answer||[]).filter(a=>a.type===1||a.type===28).map(a=>a.data);
    }));
    const addresses = records.flat();
    if (!addresses.length || addresses.some(ip=>!publicAddress(ip))) throw Error('Use a public product page URL.');
    const response = await fetcher(url.href,{ redirect:'manual',credentials:'omit',headers:{Accept:'text/html,application/xhtml+xml'},signal });
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      const destination = response.headers.get('location');
      if (!destination) throw Error('This product link has an invalid redirect.');
      url=productUrl(new URL(destination,url).href); continue;
    }
    if (!response.ok) throw Error('This shop couldn’t be read automatically. You can still save the link.');
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||'')) throw Error('Link to a product page, rather than a file or photo.');
    const reader = response.body?.getReader();
    if (!reader) throw Error('The product page was empty.');
    let size=0,html='';const decoder=new TextDecoder();
    try {
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000)throw Error('This page is too large to read automatically. You can still save the link.');html+=decoder.decode(value,{stream:true});}
      html+=decoder.decode();
    } finally { await reader.cancel(); }
    return extractProductDetails(html,url.href);
  }
  throw Error('This product link redirects too many times. Use the final product page URL.');
}
