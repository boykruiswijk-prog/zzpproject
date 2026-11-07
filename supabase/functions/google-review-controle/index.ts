import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { controleerGoogleScore } from '../_shared/googleReviewControle.ts';

Deno.serve(async req => {
  const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Methode niet toegestaan'},405);
  const admin=createClient(Deno.env.get('SUPABASE_URL') ?? '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const {data:ok}=await admin.rpc('verify_cron_secret',{p_secret:req.headers.get('x-cron-secret') ?? ''});
  if(ok!==true) return json({error:'Geen toegang'},401);
  try { return json(await controleerGoogleScore(admin,Deno.env.get('GOOGLE_PLACES_API_KEY'))); }
  catch(error) { const message=error instanceof Error?error.message:'Controle mislukt'; console.error(message); return json({error:message},500); }
});