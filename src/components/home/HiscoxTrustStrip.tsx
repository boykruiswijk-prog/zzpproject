import { ShieldCheck } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";

/**
 * Trust-builder strip: licht Hiscox uit als risicodrager voor de BAV/AVB.
 * Boy levert /public/logos/hiscox.svg aan; tot dan placeholder met serif-tekst.
 */
export function HiscoxTrustStrip() {
  return (
    <section className="bg-secondary/40 border-y border-border">
      <div className="container-wide py-10">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 max-w-4xl mx-auto">
          <div className="flex-shrink-0 flex items-center justify-center h-20 min-w-[11rem] rounded-lg bg-background border border-border px-4 py-3">
            <img
              src="/logos/hiscox.png"
              alt="Hiscox - onze verzekeringspartner"
              className="h-10 md:h-12 w-auto max-w-none object-contain"
            />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
              <ShieldCheck className="h-4 w-4" />
              Verzekerd via Hiscox
            </div>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Onze BAV en AVB lopen via Hiscox, een internationaal gerenommeerde verzekeraar
              gespecialiseerd in zakelijke aansprakelijkheid. Zo profiteer je van schaal én van
              persoonlijke begeleiding door ZP Zaken.
            </p>
            <LocalizedLink
              to="/partners"
              className="inline-block mt-2 text-sm font-medium text-accent hover:underline"
            >
              Meer over onze partners →
            </LocalizedLink>
          </div>
        </div>
      </div>
    </section>
  );
}
