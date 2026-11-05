import { ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { openTerugbelKlik } from "@/components/shared/TerugbelDialog";
import { scrollNaarAanvraag } from "@/lib/scrollNaarAanvraag";
import {
  WAAR_LET_JE_OP_INTRO, WAAR_LET_JE_OP_PUNTEN, WAAR_LET_JE_OP_TITEL,
} from "@/data/waarLetJeOpBav";

/** Herbruikbaar blok "Waar let je op bij een BAV?". Tekst uitsluitend uit src/data/waarLetJeOpBav.ts. */
export function WaarLetJeOpBav() {
  return (
    <section className="section-padding bg-background" data-blok="waar-let-je-op-bav" aria-labelledby="waar-let-je-op-bav">
      <div className="container-wide">
        <div className="mx-auto max-w-4xl">
          <h2 id="waar-let-je-op-bav" className="mb-3 text-center">{WAAR_LET_JE_OP_TITEL}</h2>
          <p className="mb-8 text-center text-muted-foreground">{WAAR_LET_JE_OP_INTRO}</p>
          <ol className="grid gap-4 md:grid-cols-2">
            {WAAR_LET_JE_OP_PUNTEN.map((p, i) => (
              <li key={p.titel} className="rounded-2xl border bg-card p-6 shadow-sm">
                <h3 className="mb-2 text-lg font-semibold">{i + 1}. {p.titel}</h3>
                <p className="mb-3 text-sm text-muted-foreground">{p.vaak}</p>
                <p className="flex gap-2 text-sm font-medium text-foreground">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <span><span className="text-accent">Bij ZP Zaken:</span> {p.bijZpZaken}</span>
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Wat precies gedekt is, staat in de <LocalizedLink to="/voorwaarden" className="text-accent underline underline-offset-4">polisvoorwaarden</LocalizedLink>.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="accent" size="lg" asChild>
              <LocalizedLink to="/verzekeringen#combinatiepolis" onClick={(e) => scrollNaarAanvraag(e)}>Online aanvragen <ArrowRight className="h-5 w-5" /></LocalizedLink>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <LocalizedLink to="/contact" onClick={openTerugbelKlik}>Bel mij terug</LocalizedLink>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
