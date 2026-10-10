import { CheckCircle, ArrowRight } from "lucide-react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { bavPakketten } from "@/data/bavPakketten";
import { STARTER } from "@/lib/starterTarief";

const PAKKET = bavPakketten[0];
const miljoen = (n: number) => `€ ${(n / 1_000_000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} miljoen`;
export const BAV_MILJOEN = miljoen(PAKKET.dekkingen.bav.perGebeurtenis);
export const AVB_MILJOEN = miljoen(PAKKET.dekkingen.avb.perGebeurtenis);

const BEROEPEN = [
  { to: "/zzp-verzekering-ict", label: "ICT-freelancers" },
  { to: "/zzp-verzekering-consultant", label: "Consultants" },
  { to: "/zzp-verzekering-interim-manager", label: "Interim managers" },
  { to: "/zzp-verzekering-finance", label: "Finance professionals" },
  { to: "/zzp-verzekering-hr", label: "HR-professionals" },
  { to: "/zzp-verzekering-marketing", label: "Marketing en communicatie" },
  { to: "/zzp-verzekering-coach", label: "Coaches en trainers" },
];

/** Vaste klantwaarheid, starters en voor wie: gedeeld door de advertentie-landingspagina's. */
export function LandingVerzekeringBlokken() {
  const punten = [
    "BAV en AVB in één polis via Hiscox",
    `${BAV_MILJOEN} BAV en ${AVB_MILJOEN} AVB per aanspraak`,
    "Geen eigen risico",
    "Geen jaarcontract, dagelijks opzegbaar",
    "Binnen 24 uur geregeld, met certificaat per mail voor je opdrachtgever",
    "Dekking vanaf de ingangsdatum die je zelf kiest, volgens de polisvoorwaarden",
  ];
  return (
    <section className="section-padding bg-background">
      <div className="container-wide max-w-5xl mx-auto grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-5">Wat je krijgt</h2>
          <ul className="space-y-3">
            {punten.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">
            Wat precies gedekt is, lees je in de{" "}
            <LocalizedLink to="/voorwaarden" className="text-accent underline underline-offset-4">polisvoorwaarden</LocalizedLink>.
          </p>
          <div className="mt-8 rounded-2xl border border-border bg-secondary p-6">
            <h3 className="text-lg font-semibold mb-2">Net begonnen? Het starterspakket</h3>
            <p className="text-muted-foreground">
              € {STARTER.maandprijs} per maand of € {STARTER.jaarprijs} per jaar de eerste {STARTER.duurMaanden} maanden, daarna € {STARTER.naMaandprijs} per maand of € {STARTER.naJaarprijs} per jaar. Geldt bij een KVK-inschrijving jonger dan 12 maanden.
            </p>
            <LocalizedLink to="/starters" className="mt-3 inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Bekijk het starterspakket <ArrowRight className="h-4 w-4" />
            </LocalizedLink>
          </div>
        </div>
        <div>
          <h2 className="mb-5 text-2xl">Voor wie</h2>
          <p className="text-muted-foreground mb-4">Voor zzp'ers met een kantoorberoep, bijvoorbeeld:</p>
          <ul className="space-y-2">
            {BEROEPEN.map((b) => (
              <li key={b.to}>
                <LocalizedLink to={b.to} className="inline-flex items-center gap-1 text-accent hover:underline">
                  {b.label} <ArrowRight className="h-4 w-4" />
                </LocalizedLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
