import { Fragment } from "react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { getPakket, formatMiljoenKort } from "@/data/bavPakketten";
import { CyberVoorwaardenTekst } from "@/components/shared/CyberVoorwaardenTekst";

const BEROEPSPAGINAS = new Set([
  "/bav-zzp", "/beroepsaansprakelijkheidsverzekering",
  "/zzp-verzekering-ict", "/zzp-verzekering-consultant",
  "/zzp-verzekering-interim-manager", "/zzp-verzekering-finance",
  "/zzp-verzekering-hr", "/zzp-verzekering-marketing",
  "/zzp-verzekering-coach", "/zzp-verzekering-zorg", "/zzp-verzekering-bouw",
]);

export const isBeroepspagina = (pad: string) => BEROEPSPAGINAS.has(pad);

/** Alleen prijsweergave; de pakketbedragen en aanvraag blijven ongewijzigd. */
export function beroepspaginaPrijsregel() {
  const maand = getPakket("maandelijks");
  const jaar = getPakket("jaarlijks");
  return `Vanaf € ${maand.prijs} per maand of € ${jaar.prijs} per jaar, inclusief kosten en assurantiebelasting · BAV ${formatMiljoenKort(maand.dekkingen.bav.perGebeurtenis).replace("€", "€ ")} · AVB ${formatMiljoenKort(maand.dekkingen.avb.perGebeurtenis).replace("€", "€ ")} per aanspraak`;
}

/** Laat de oorspronkelijke tekst (en daarmee de FAQ-structured data) intact. Extra links zijn opt-in per FAQ. */
export function BeroepspaginaTekst({ tekst, links }: { tekst: string; links?: Record<string, string> }) {
  const extra = Object.keys(links ?? {});
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patroon = new RegExp(`(${["polisvoorwaarden", esc("Hoeveel dekking heb je nodig met je BAV?"), ...extra.map(esc)].join("|")})`, "gi");
  return <>{tekst.split(patroon).map((deel, i) => (
    links && deel in links
      ? <LocalizedLink key={i} to={links[deel]} className="underline underline-offset-4">{deel}</LocalizedLink>
      : /^polisvoorwaarden$/i.test(deel)
      ? <LocalizedLink key={i} to="/voorwaarden" className="underline underline-offset-4">{deel}</LocalizedLink>
      : deel === "Hoeveel dekking heb je nodig met je BAV?"
        ? <LocalizedLink key={i} to="/kennisbank/verzekerd-bedrag-bav-zzp" className="underline underline-offset-4">{deel}</LocalizedLink>
        : <Fragment key={i}><CyberVoorwaardenTekst tekst={deel} /></Fragment>
  ))}</>;
}
