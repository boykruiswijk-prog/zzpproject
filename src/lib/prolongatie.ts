// D8 prolongatie jaarpolis (besluit Boy 15-10-2026). Byte-gelijk met src/lib/prolongatie.ts.
// Database-tegenhanger: public.prolongatie_mails (een mail per klant per verlengdatum).
export const PROLONGATIE_DAGEN_VOORAF = 14;

export function plusDagenISO(iso: string, n: number): string {
  return new Date(new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}

export function isProlongatieKandidaat(
  c: { cyclus: string; status: string; is_test?: boolean | null; volgende_factuurdatum: string | null; opgezegd: boolean },
  vandaag: string,
): boolean {
  return c.cyclus === "jaar" && ["actief", "einddatum_controle"].includes(c.status) && !c.is_test && !c.opgezegd
    && c.volgende_factuurdatum === plusDagenISO(vandaag, PROLONGATIE_DAGEN_VOORAF);
}

/** Spiegel van public.prolongatie_mails: per klant en verlengdatum; alleen mail bij bav_avb; bedrag = bav_avb + cyber_clear. */
export function prolongatieMails(contracten: { onderneming_id: string; product: string; verlengdatum: string; netto: number }[]) {
  const groep = new Map<string, { onderneming_id: string; verlengdatum: string; producten: string[]; bedrag: number }>();
  for (const c of contracten) {
    const k = `${c.onderneming_id}|${c.verlengdatum}`;
    const g = groep.get(k) ?? { onderneming_id: c.onderneming_id, verlengdatum: c.verlengdatum, producten: [], bedrag: 0 };
    g.producten.push(c.product);
    if (c.product === "bav_avb" || c.product === "cyber_clear") g.bedrag = Math.round((g.bedrag + c.netto) * 100) / 100;
    groep.set(k, g);
  }
  return [...groep.values()].map((g) => ({ ...g, mail: g.producten.includes("bav_avb") }));
}
