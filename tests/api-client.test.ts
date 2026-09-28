import test from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse,SignInRequiredError} from '../lib/api-client';
test('expired Sites sessions are recognized even when the login gate returns 200',async()=>{
 for(const body of ['<!DOCTYPE html><html>Log in to access <a href="/signin-with-chatgpt?return_to=/">Continue with ChatGPT</a></html>','<a href="/signin-with-chatgpt">Sign in</a>']){
  await assert.rejects(readApiResponse(new Response(body,{headers:{'Content-Type':'text/html'}})),SignInRequiredError);
 }
 await assert.rejects(readApiResponse(new Response(JSON.stringify({error:'Sign in to access your wardrobe.'}),{status:401})),SignInRequiredError);
});
test('valid data and real service errors remain distinct from expired sessions',async()=>{
 assert.deepEqual(await readApiResponse(new Response('{"revision":217}')),{revision:217});
 await assert.rejects(readApiResponse(new Response('<html>Service unavailable</html>',{status:503,headers:{'Content-Type':'text/html'}})),e=>e instanceof Error&&!(e instanceof SignInRequiredError)&&e.message.includes('did not respond'));
 await assert.rejects(readApiResponse(new Response('{"error":"Your wardrobe changed in another tab."}',{status:409})),/changed in another tab/);
});
