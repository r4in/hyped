export const signInMessage = 'Your session has expired. Sign in again to access your saved wardrobe.';
export class SignInRequiredError extends Error {
  constructor(){super(signInMessage);this.name='SignInRequiredError';}
}

export async function readApiResponse<T>(response:Response):Promise<T>{
  const body=await response.text();
  // Sites may return its HTML sign-in gate with HTTP 200 after a session expires.
  // Do not interpret that page as wardrobe data, or retry a write automatically.
  const html=/^\s*(?:<!doctype html|<html)/i.test(body)||response.headers.get('content-type')?.includes('text/html');
  const authPage=html&&/\/signin-with-chatgpt|Continue with ChatGPT|Log in to access/i.test(body);
  if(response.status===401||authPage)throw new SignInRequiredError();
  let data:unknown;
  try{data=JSON.parse(body);}catch{throw Error('The service did not respond. Please retry.');}
  if(!response.ok){
    const message=data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:'Something went wrong. Please retry.';
    throw Error(message);
  }
  return data as T;
}

export async function api<T>(url:string,options?:RequestInit):Promise<T>{
  return readApiResponse<T>(await fetch(url,{cache:'no-store',...options}));
}
