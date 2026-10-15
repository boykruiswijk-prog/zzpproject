import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { HoneypotField } from '@/components/shared/HoneypotField';
import { useFormGuard, submitPublicForm, PublicFormError } from '@/lib/antiSpam';
import { supabase } from '@/integrations/supabase/client';
import { maakFormulier } from '../../../supabase/functions/_shared/leadVelden';
import { EVI_FORMULIER_NAAM, EVI_PAGINA_PAD } from '@/config/eviPagina';
import { ArrowRight, CheckCircle } from 'lucide-react';
export function EviInteresseFormulier() {
 const guard=useFormGuard(); const [status,setStatus]=useState<'klaar'|'bezig'|'gelukt'>('klaar'); const [fout,setFout]=useState('');
 async function verstuur(e:React.FormEvent<HTMLFormElement>) {
  e.preventDefault(); if(status==='bezig')return; const d=new FormData(e.currentTarget); if(!d.get('toestemming'))return;
  setStatus('bezig'); setFout(''); const v=(k:string)=>String(d.get(k)||'').trim();
  try { const id=crypto.randomUUID(); await submitPublicForm('leads',{id,type:'contact',voornaam:v('voornaam'),achternaam:v('achternaam'),email:v('email'),telefoon:v('telefoon'),opmerkingen:v('vraag'),extra_data:{formulier_naam:EVI_FORMULIER_NAAM,pagina:EVI_PAGINA_PAD,interne_bron:'evi-pagina',toestemming:true,formulier:maakFormulier([['Voornaam',v('voornaam')],['Achternaam',v('achternaam')],['E-mail',v('email')],['Telefoon',v('telefoon')],['Je vraag',v('vraag')],['Toestemming contact over pensioen via Evi','Ja']])}},guard);
   supabase.functions.invoke('send-notification',{body:{type:'contact',lead_id:id}}).catch(()=>{}); setStatus('gelukt');
  }catch(err){setFout(err instanceof PublicFormError?err.message:'Verzenden mislukt. Probeer het opnieuw of bel ons.');setStatus('klaar');}
 }
 return <section id="interesse-evi" className="scroll-mt-24 py-16 md:py-24 border-t border-border"><div className="container-wide grid lg:grid-cols-2 gap-10 lg:gap-24"><div><p className="text-accent text-sm font-semibold mb-3">PERSOONLIJK CONTACT</p><h2>Meer weten over pensioen via Evi?</h2><p className="mt-6 text-muted-foreground leading-relaxed">Laat je gegevens achter, dan neemt ons team persoonlijk contact met je op en helpen we je op weg naar Evi van Lanschot.</p></div>{status==='gelukt'?<div role="status" className="py-8"><CheckCircle className="text-accent h-10 w-10 mb-4"/><p className="text-xl font-semibold">Dank je. We nemen binnen 24 uur contact met je op.</p></div>:<form onSubmit={verstuur} className="space-y-5"><HoneypotField guard={guard}/><div className="grid sm:grid-cols-2 gap-5">{(['voornaam','achternaam','email','telefoon'] as const).map(k=><div key={k} className="space-y-2"><Label htmlFor={`evi-${k}`}>{({voornaam:'Voornaam',achternaam:'Achternaam',email:'E-mail',telefoon:'Telefoon'})[k]} *</Label><Input id={`evi-${k}`} name={k} required type={k==='email'?'email':k==='telefoon'?'tel':'text'} autoComplete={k==='voornaam'?'given-name':k==='achternaam'?'family-name':k==='email'?'email':'tel'} maxLength={k==='telefoon'?30:255} pattern={k==='telefoon'?'[0-9+ ()-]{10,30}':undefined} className="h-12"/></div>)}</div><div className="space-y-2"><Label htmlFor="evi-vraag">Je vraag (optioneel)</Label><Textarea id="evi-vraag" name="vraag" rows={4} maxLength={5000}/></div><div className="flex items-start gap-3"><input id="evi-toestemming" name="toestemming" type="checkbox" required className="mt-1 accent-accent"/><Label htmlFor="evi-toestemming" className="text-sm font-normal leading-relaxed">Ik geef ZP Zaken toestemming om contact met mij op te nemen over pensioen via Evi van Lanschot. ZP Zaken deelt mijn gegevens pas met Evi als ik daar zelf om vraag.</Label></div>{fout&&<p role="alert" className="text-destructive">{fout}</p>}<Button variant="accent" size="lg" disabled={status==='bezig'} type="submit" className="w-full sm:w-auto">{status==='bezig'?'Verzenden...':'Neem contact met mij op'}<ArrowRight/></Button></form>}</div></section>;
}
