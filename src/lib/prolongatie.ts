// D8 prolongatie jaarpolis (besluit Boy 15-10-2026). Byte-gelijk met src/lib/prolongatie.ts.
// Database-tegenhanger: public.prolongatie_kandidaten.
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
