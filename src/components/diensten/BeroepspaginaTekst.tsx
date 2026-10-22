import { Fragment } from "react";
import { LocalizedLink } from "@/components/LocalizedLink";
import { getPakket, formatMiljoenKort } from "@/data/bavPakketten";

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
  return `Vanaf € ${maand.prijs} per maand of € ${jaar.prijs} per jaar, incl. kosten en assurantiebelasting · BAV ${formatMiljoenKort(maand.dekkingen.bav.perGebeurtenis).replace("€", "€ ")} · AVB ${formatMiljoenKort(maand.dekkingen.avb.perGebeurtenis).replace("€", "€ ")} per aanspraak`;
}

/** Laat de oorspronkelijke tekst (en daarmee de FAQ-structured data) intact. */
export function BeroepspaginaTekst({ tekst }: { tekst: string }) {
  return <>{tekst.split(/(polisvoorwaarden)/gi).map((deel, i) => (
    /^polisvoorwaarden$/i.test(deel)
      ? <LocalizedLink key={i} to="/voorwaarden" className="underline underline-offset-4">{deel}</LocalizedLink>
      : <Fragment key={i}>{deel}</Fragment>
  ))}</>;
}