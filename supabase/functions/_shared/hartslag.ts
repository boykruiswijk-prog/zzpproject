// A31 Puls / Hartslag: pure beoordelingsregels (getest in src/test/hartslagPuls.test.ts).
export type Meting = { onderdeel: string; ok: boolean; reden: string };

export const HARTSLAG_PAGINAS: { pad: string; tekst: string }[] = [
  { pad: "/", tekst: "Zorgeloos ondernemen" },
  { pad: "/verzekeringen", tekst: "BAV &amp; AVB" },
  { pad: "/offerte", tekst: "Vrijblijvende offerte aanvragen" },
  { pad: "/bav-zzp", tekst: "BAV verzekering voor zzp" },
  { pad: "/contact", tekst: "Contact opnemen" },
];
export const BEWAAR_DAGEN = 14;

export function beoordeelPagina(pad: string, status: number, html: string, tekst: string): Meting {
  const onderdeel = `pagina ${pad}`;
  if (status !== 200) return { onderdeel, ok: false, reden: `status ${status}` };
  if (!html.includes(tekst)) return { onderdeel, ok: false, reden: "vaste tekst ontbreekt" };
  return { onderdeel, ok: true, reden: "200 en tekst aanwezig" };
}

type MailRij = { recipient_email: string | null; template_name: string | null; status: string; created_at: string };
/** Fout als een mislukte verzending in het afgelopen uur niet later alsnog lukte (zelfde ontvanger en template). */
export function beoordeelMail(rijen: MailRij[]): Meting {
  const mislukt = rijen.filter((r) => ["failed", "bounced", "error", "dlq"].includes(r.status));
  const open = mislukt.filter((m) => !rijen.some((r) => r.status === "sent" && r.recipient_email === m.recipient_email
    && r.template_name === m.template_name && Date.parse(r.created_at) > Date.parse(m.created_at)));
  return open.length ? { onderdeel: "mailverzending", ok: false, reden: `${open.length} mislukt zonder herstel` } : { onderdeel: "mailverzending", ok: true, reden: "geen open mislukkingen" };
}

type SyncRij = { status: string; created_at: string };
/** Fout als de laatste fout in 2 uur niet gevolgd is door een geslaagde koppeling. */
export function beoordeelExact(rijen: SyncRij[]): Meting {
  const goed = ["success", "ok", "sent"];
  const laatsteFout = Math.max(-Infinity, ...rijen.filter((r) => r.status === "error" || r.status === "failed").map((r) => Date.parse(r.created_at)));
  if (laatsteFout === -Infinity) return { onderdeel: "exact-koppeling", ok: true, reden: "geen fouten" };
  const hersteld = rijen.some((r) => goed.includes(r.status) && Date.parse(r.created_at) > laatsteFout);
  return hersteld ? { onderdeel: "exact-koppeling", ok: true, reden: "fout later hersteld" } : { onderdeel: "exact-koppeling", ok: false, reden: "fout zonder latere success" };
}

/** Rood als de laatste twee metingen van een onderdeel allebei fout zijn (spiegel van hartslag_status()). */
export function isRood(laatste: { ok: boolean }[]): boolean {
  return laatste.length >= 2 && !laatste[0].ok && !laatste[1].ok;
}

/** Spiegel van hartslag_opruimen(): metingen ouder dan 14 dagen vervallen. */
export function teVerwijderen(gemeten_op: string, nu = new Date()): boolean {
  return nu.getTime() - Date.parse(gemeten_op) > BEWAAR_DAGEN * 86_400_000;
}

/** Puls op het scherm: rood zodra één onderdeel rood is. */
export function pulsRood(status: unknown): boolean {
  return Array.isArray(status) && status.some((s) => s && typeof s === "object" && (s as { rood?: unknown }).rood === true);
}
