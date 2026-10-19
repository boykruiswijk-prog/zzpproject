import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { berekenJaarruimte, pensioenEuro as euro } from '@/lib/pensioenRekenhulp';
import { zetEviJaarruimte, dagenTotEindeJaar } from '@/lib/eviJaarruimte';
import { EVI_RISICO } from '@/data/eviPensioen';

export function JaarruimteHero() {
  const [winst, setWinst] = useState('60000');
  const basis = berekenJaarruimte({ winst: Number(winst) });
  const voordeel = berekenJaarruimte({ winst: Number(winst), inleg: basis.jaarruimte }).teruggave;
  const dagen = dagenTotEindeJaar();
  function benutten() {
    zetEviJaarruimte(basis.jaarruimte);
    document.getElementById('interesse-evi')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('evi-voornaam')?.focus({ preventScroll: true }), 600);
  }
  return <div id="jaarruimte-hero" className="scroll-mt-24 bg-card border border-border rounded-lg p-5 sm:p-7 shadow-sm">
    <h2 className="text-xl sm:text-2xl font-semibold">Bereken je jaarruimte 2026</h2>
    <div className="space-y-2 mt-5">
      <Label htmlFor="hero-winst">Je winst over 2025, vóór ondernemersaftrek</Label>
      <Input id="hero-winst" type="number" inputMode="decimal" min="0" step="any" value={winst} onChange={e => setWinst(e.target.value)} className="h-12 text-lg bg-background" />
    </div>
    <div key={basis.jaarruimte} aria-live="polite" className="mt-6 border-l-4 border-[hsl(var(--evi-paars))] pl-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
      <p className="text-sm text-muted-foreground">Je jaarruimte</p>
      <p className="text-4xl font-bold tabular-nums text-[hsl(var(--evi-paars))]">{euro(basis.jaarruimte)}</p>
      <p className="mt-3 text-sm text-muted-foreground">Geschat belastingvoordeel als je dit hele bedrag inlegt</p>
      <p className="text-2xl font-semibold tabular-nums">ongeveer {euro(voordeel)}</p>
    </div>
    <Button variant="accent" size="lg" onClick={benutten} className="w-full mt-6 min-h-12 h-auto whitespace-normal">Ik wil dit benutten<ArrowRight /></Button>
    <p className="mt-5 flex items-start gap-3 text-sm leading-relaxed"><CalendarClock className="h-5 w-5 shrink-0 text-accent" aria-hidden />
      <span>Inleg uiterlijk 31 december 2026 betaald voor aftrek over 2026. {dagen > 0 ? <>Nog <strong>{dagen} {dagen === 1 ? 'dag' : 'dagen'}</strong>.</> : null}</span></p>
    <p className="mt-4 text-xs text-muted-foreground leading-relaxed">Indicatie, vereenvoudigd. {EVI_RISICO}</p>
  </div>;
}
