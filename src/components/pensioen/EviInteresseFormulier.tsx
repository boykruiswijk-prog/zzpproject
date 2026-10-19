import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { HoneypotField } from '@/components/shared/HoneypotField';
import { useFormGuard, submitPublicForm, PublicFormError } from '@/lib/antiSpam';
import { supabase } from '@/integrations/supabase/client';
import { maakFormulier } from '../../../supabase/functions/_shared/leadVelden';
import { EVI_FORMULIER_NAAM, EVI_PAGINA_PAD } from '@/config/eviPagina';
import { leesEviJaarruimte, EVI_JAARRUIMTE_EVENT } from '@/lib/eviJaarruimte';
import { trackEviInteresseVerstuurd } from '@/lib/tracking';
import { pensioenEuro as euro } from '@/lib/pensioenRekenhulp';
import { ArrowRight, CheckCircle } from 'lucide-react';

export function EviInteresseFormulier() {
  const guard = useFormGuard();
  const [status, setStatus] = useState<'klaar' | 'bezig' | 'gelukt'>('klaar');
  const [fout, setFout] = useState('');
  const [jaarruimte, setJaarruimte] = useState('');
  useEffect(() => {
    const opgeslagen = leesEviJaarruimte();
    if (opgeslagen !== null) setJaarruimte(String(opgeslagen));
    const luister = (e: Event) => setJaarruimte(String((e as CustomEvent<number>).detail));
    window.addEventListener(EVI_JAARRUIMTE_EVENT, luister);
    return () => window.removeEventListener(EVI_JAARRUIMTE_EVENT, luister);
  }, []);
  async function verstuur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (status === 'bezig') return;
    const d = new FormData(e.currentTarget); if (!d.get('toestemming')) return;
    setStatus('bezig'); setFout('');
    const v = (k: string) => String(d.get(k) || '').trim();
    const ruimte = jaarruimte.trim() === '' ? null : Math.max(0, Math.round(Number(jaarruimte)) || 0);
    try {
      const id = crypto.randomUUID();
      await submitPublicForm('leads', {
        id, type: 'contact', voornaam: v('voornaam'), achternaam: v('achternaam'), email: v('email'), ...(v('telefoon') ? { telefoon: v('telefoon') } : {}),
        extra_data: {
          formulier_naam: EVI_FORMULIER_NAAM, pagina: EVI_PAGINA_PAD, interne_bron: 'evi-pagina', toestemming: true, jaarruimte_berekend: ruimte,
          formulier: maakFormulier([['Voornaam', v('voornaam')], ['Achternaam', v('achternaam')], ['E-mail', v('email')], ['Telefoon', v('telefoon')], ['Berekende jaarruimte 2026', ruimte === null ? '' : euro(ruimte)], ['Toestemming contact over pensioen via Evi', 'Ja']]),
        },
      }, guard);
      supabase.functions.invoke('send-notification', { body: { type: 'contact', lead_id: id } }).catch(() => {});
      trackEviInteresseVerstuurd();
      setStatus('gelukt');
    } catch (err) { setFout(err instanceof PublicFormError ? err.message : 'Verzenden mislukt. Probeer het opnieuw of bel ons.'); setStatus('klaar'); }
  }
  return <section id="interesse-evi" className="scroll-mt-24 py-16 md:py-24 border-t border-border"><div className="container-wide grid lg:grid-cols-2 gap-10 lg:gap-24">
    <div><h2>Wil je je jaarruimte benutten?</h2><p className="mt-6 text-muted-foreground leading-relaxed">Laat je gegevens achter. Ons team neemt persoonlijk contact met je op en helpt je op weg naar Evi van Lanschot.</p></div>
    {status === 'gelukt'
      ? <div role="status" className="py-4"><CheckCircle className="text-accent h-10 w-10 mb-4" aria-hidden /><p className="text-xl font-semibold">Dank je, we hebben je gegevens.</p><p className="mt-4 font-medium">Wat gebeurt er nu?</p><ol className="mt-3 space-y-2 list-decimal pl-5 text-muted-foreground leading-relaxed"><li>We nemen binnen 24 uur contact met je op.</li><li>We lopen samen je jaarruimte en de stappen bij Evi door.</li><li>Je kiest daarna zelf of je een Lijfrente-opbouw bij Evi opent.</li></ol></div>
      : <form onSubmit={verstuur} className="space-y-5"><HoneypotField guard={guard} />
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-2"><Label htmlFor="evi-voornaam">Voornaam *</Label><Input id="evi-voornaam" name="voornaam" required autoComplete="given-name" maxLength={100} className="h-12" /></div>
          <div className="space-y-2"><Label htmlFor="evi-achternaam">Achternaam *</Label><Input id="evi-achternaam" name="achternaam" required autoComplete="family-name" maxLength={100} className="h-12" /></div>
          <div className="space-y-2"><Label htmlFor="evi-email">E-mail *</Label><Input id="evi-email" name="email" type="email" required autoComplete="email" maxLength={255} className="h-12" /></div>
          <div className="space-y-2"><Label htmlFor="evi-telefoon">Telefoon (optioneel)</Label><Input id="evi-telefoon" name="telefoon" type="tel" autoComplete="tel" maxLength={30} pattern="[0-9+ ()-]{10,30}" className="h-12" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="evi-jaarruimte">Je jaarruimte 2026 (uit de rekenhulp, optioneel)</Label><Input id="evi-jaarruimte" name="jaarruimte" type="number" inputMode="numeric" min="0" step="1" value={jaarruimte} onChange={e => setJaarruimte(e.target.value)} className="h-12" /></div>
        </div>
        <div className="flex items-start gap-3"><Checkbox id="evi-toestemming" name="toestemming" required className="mt-1" /><Label htmlFor="evi-toestemming" className="text-sm font-normal leading-relaxed">Ik geef ZP Zaken toestemming om contact met mij op te nemen over pensioen via Evi van Lanschot. ZP Zaken deelt mijn gegevens pas met Evi als ik daar zelf om vraag.</Label></div>
        {fout && <p role="alert" className="text-destructive">{fout}</p>}
        <Button variant="accent" size="lg" disabled={status === 'bezig'} type="submit" className="w-full sm:w-auto">{status === 'bezig' ? 'Verzenden...' : 'Stuur mij informatie over Evi'}<ArrowRight /></Button>
      </form>}
  </div></section>;
}
