import { useEffect, useState } from 'react';
import { Calculator, Phone } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site';

/** Alleen mobiel: verschijnt na de hero, verdwijnt zodra het interesseformulier in beeld is. */
export function EviStickyBalk() {
  const [naHero, setNaHero] = useState(false);
  const [formulier, setFormulier] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('evi-hero');
    const form = document.getElementById('interesse-evi');
    if (!hero || !form || typeof IntersectionObserver === 'undefined') return;
    const oh = new IntersectionObserver(([e]) => setNaHero(!e.isIntersecting && e.boundingClientRect.top < 0));
    const of = new IntersectionObserver(([e]) => setFormulier(e.isIntersecting));
    oh.observe(hero); of.observe(form);
    return () => { oh.disconnect(); of.disconnect(); };
  }, []);
  if (!naHero || formulier) return null;
  return <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
    <div className="grid grid-cols-2 gap-2">
      <a href="#jaarruimte-hero" className="inline-flex items-center justify-center gap-2 rounded-md bg-accent text-accent-foreground min-h-12 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Calculator className="h-4 w-4" aria-hidden />Bereken je jaarruimte</a>
      <a href={`tel:${SITE_CONFIG.phone}`} className="inline-flex items-center justify-center gap-2 rounded-md border border-border min-h-12 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Phone className="h-4 w-4" aria-hidden />Bel ons</a>
    </div>
  </div>;
}
