// Verzendcheck voor nieuwe klantmails: leest klantmail_instellingen altijd vers uit de database.
// Elke nieuwe klantmail gaat alleen via magKlantmailVersturen plus createMailGate.
// deno-lint-ignore-file no-explicit-any
import { schakelaarStaatAan } from "./klantmailTekst.ts";

export async function magKlantmailVersturen(db: any, sleutel: string): Promise<{ mag: boolean; rij: any }> {
  const { data, error } = await db.from("klantmail_instellingen").select("sleutel,actief,status,onderwerp,tekst").eq("sleutel", sleutel).maybeSingle();
  if (error || !data) return { mag: false, rij: null };
  return { mag: schakelaarStaatAan(data), rij: data };
}

export async function logKlantmail(db: any, rij: Record<string, unknown>) {
  try { await db.from("klantmail_log").insert(rij); } catch (_e) { /* log mag de run niet stoppen */ }
}

/** Zelfde logica als mailCertificaat: e-mail van de lead, anders van een persoon van de onderneming. */
export async function klantOntvanger(db: any, ondernemingId: string | null, leadId: string | null): Promise<{ email: string | null; voornaam: string | null }> {
  if (leadId) {
    const { data: l } = await db.from("leads").select("email,voornaam").eq("id", leadId).maybeSingle();
    if (l?.email?.trim()) return { email: l.email.trim(), voornaam: l.voornaam ?? null };
  }
  if (ondernemingId) {
    const { data: po } = await db.from("persoon_onderneming").select("personen(voornaam,email_weergave)").eq("onderneming_id", ondernemingId);
    const p = (po || []).map((x: any) => x.personen).find((x: any) => x?.email_weergave);
    if (p) return { email: String(p.email_weergave).trim(), voornaam: p.voornaam ?? null };
  }
  return { email: null, voornaam: null };
}
