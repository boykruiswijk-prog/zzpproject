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

/** Rechtsvormwijziging waarbij de opvolger geen eigen BAV + AVB-contract heeft: het contract van de voorganger kan mee (server beslist definitief). */
export type OpenContractMee = { opvolgingId: string; vanId: string; vanNaam: string; ingangsdatum: string };
type ContractRij = { onderneming_id: string; product: string; status: string; eind_datum: string | null };
const LOPEND = ["actief", "loopt_af", "einddatum_controle"];
const dagVoor = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

export function openContractMeenemen(ondernemingId: string, opvolgingen: OpvRij[], contracten: ContractRij[], namen: Record<string, string>): OpenContractMee | null {
  for (const o of opvolgingen) {
    if (o.naar_onderneming_id !== ondernemingId || o.soort !== "rechtsvormwijziging") continue;
    const eigen = contracten.some((c) => c.onderneming_id === ondernemingId && c.product === "bav_avb" && LOPEND.includes(c.status) && (!c.eind_datum || c.eind_datum >= o.ingangsdatum));
    if (eigen) return null;
    const mee = contracten.some((c) => c.onderneming_id === o.van_onderneming_id && c.product === "bav_avb" && LOPEND.includes(c.status) && (!c.eind_datum || c.eind_datum >= dagVoor(o.ingangsdatum)));
    if (mee) return { opvolgingId: o.id, vanId: o.van_onderneming_id, vanNaam: namen[o.van_onderneming_id] ?? "de voorganger", ingangsdatum: o.ingangsdatum };
  }
  return null;
}
