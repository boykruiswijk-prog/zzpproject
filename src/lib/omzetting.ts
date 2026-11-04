// Pure regels voor omzetting en het afronden van een aanvraag (gedeeld met tests; server hanteert dezelfde grenzen).

/** Invoer "Omzetten naar BV": onderneming, datum en toelichting van minstens 10 tekens. */
export function omzettenInvoerFout(i: { naarId: string | null; datum: string; reden: string }): string | null {
  if (!i.naarId) return "Kies de nieuwe onderneming.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.datum)) return "Kies de ingangsdatum van de BV.";
  if (i.reden.trim().length < 10) return "Toelichting is verplicht (minimaal 10 tekens).";
  return null;
}

export type AanvraagStap = { sleutel: string; label: string; automatisch: string; klaar: boolean; op?: string | null };

/** Een aanvraag is pas afgerond als het certificaat verstuurd is, of na een handmatige keuze met reden. */
export function aanvraagAfgerond(l: { aanvraag_afgerond_op?: string | null }): boolean {
  return !!l.aanvraag_afgerond_op;
}

/** Handmatig afronden: reden van minstens 10 tekens. */
export function handmatigAfrondenFout(reden: string): string | null {
  return reden.trim().length < 10 ? "Geef een reden (minimaal 10 tekens)." : null;
}

/** Opvolging (rechtsvormwijziging) waarvan de polis nog bij de voorganger staat. */
export type OpenOmzetting = { opvolgingId: string; vanId: string; vanNaam: string; policyId: string; certificaatnummer: string | null; ingangsdatum: string; reden: string };
type OpvRij = { id: string; van_onderneming_id: string; naar_onderneming_id: string; soort: string; ingangsdatum: string };
type PolisRij = { id: string; onderneming_id: string | null; status: string; certificate_number: string | null };

/** Open als: opvolging naar deze onderneming, soort rechtsvormwijziging, hier geen geldige polis, bij de voorganger wel. */
export function openOmzetting(ondernemingId: string, opvolgingen: OpvRij[], polissen: PolisRij[], namen: Record<string, string>): OpenOmzetting | null {
  if (polissen.some((p) => p.onderneming_id === ondernemingId && p.status === "geldig")) return null;
  for (const o of opvolgingen) {
    if (o.naar_onderneming_id !== ondernemingId || o.soort !== "rechtsvormwijziging") continue;
    const p = polissen.find((x) => x.onderneming_id === o.van_onderneming_id && x.status === "geldig");
    if (p) return { opvolgingId: o.id, vanId: o.van_onderneming_id, vanNaam: namen[o.van_onderneming_id] ?? "de voorganger", policyId: p.id, certificaatnummer: p.certificate_number, ingangsdatum: o.ingangsdatum, reden: omzetReden(o.id) };
  }
  return null;
}

/** Vaste toelichting bij omzetting vanuit een opvolging (minimaal 10 tekens). */
export function omzetReden(opvolgingId: string): string {
  return `opvolging ${opvolgingId.slice(0, 8)}, rechtsvormwijziging`;
}

/** Koptekst BAV-nummer: bij open omzetting nooit een nummer tonen dat nog niet op deze onderneming staat. */
export function bavKopTekst(nummer: string | null | undefined, open: OpenOmzetting | null): string {
  if (open) return `BAV-nummer wordt overgenomen van ${open.vanNaam}`;
  return nummer ? `BAV-nummer ${nummer}` : "BAV-nummer onbekend";
}

/** Polis meenemen bij opvolging vastleggen: alleen bij rechtsvormwijziging en een geldige polis. */
export function polisMeenemenMogelijk(soort: string, geldigePolis: { id: string } | null): boolean {
  return soort === "rechtsvormwijziging" && !!geldigePolis;
}
