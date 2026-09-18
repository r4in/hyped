import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export async function identity(request?:Request){const user=await getChatGPTUser();if(!user)throw new Error('Sign in to access your wardrobe.');if(request&&request.method!=='GET'){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Error('Invalid request origin.');}return user.userId;}
export function db(){const binding=(env as unknown as {DB:D1Database}).DB;if(!binding)throw Error('Wardrobe storage is temporarily unavailable.');return binding;}
export function bucket(){const binding=(env as unknown as {BUCKET:R2Bucket}).BUCKET;if(!binding)throw Error('Photo storage is temporarily unavailable.');return binding;}
export function failure(e:unknown){console.error(e);return Response.json({error:e instanceof Error&&e.message==='Sign in to access your wardrobe.'?e.message:'Could not access storage. Your changes have not been saved. Please retry.'},{status:e instanceof Error&&e.message.includes('Sign in')?401:503});}
