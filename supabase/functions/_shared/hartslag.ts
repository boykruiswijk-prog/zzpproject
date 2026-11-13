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

export const SCHERM_TIMEOUT_MS = 20_000;
const SCHERM_HERHAAL_WACHT_MS = 250;

function schermFoutSoort(fout: unknown): "time-out" | "netwerkfout" {
  const naam = typeof fout === "object" && fout !== null && "name" in fout ? String(fout.name) : "";
  return naam === "AbortError" ? "time-out" : "netwerkfout";
}

/** Eén herhaling alleen bij een time-out/netwerkfout; een HTTP-fout blijft direct zichtbaar. */
export async function meetSchermData(
  url: string,
  headers: Record<string, string>,
  ophaal: typeof fetch = fetch,
  timeoutMs = SCHERM_TIMEOUT_MS,
  wacht: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Meting> {
  const gestart = Date.now();
  let eersteFout = "";
  for (const poging of [1, 2] as const) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const reactie = await ophaal(url, { headers, signal: controller.signal });
      await reactie.text();
      const duur = Date.now() - gestart;
      if (reactie.status === 200) {
        return { onderdeel: "scherm-data", ok: true, reden: poging === 1 ? `200 (${duur} ms)` : `200 na herhaling (${duur} ms; eerste poging ${eersteFout})` };
      }
      return { onderdeel: "scherm-data", ok: false, reden: `status ${reactie.status}${poging === 2 ? " na herhaling" : ""} (${duur} ms)` };
    } catch (fout) {
      const soort = schermFoutSoort(fout);
      if (poging === 2) return { onderdeel: "scherm-data", ok: false, reden: `${soort} na 2 pogingen (${Date.now() - gestart} ms)` };
      eersteFout = soort;
      await wacht(SCHERM_HERHAAL_WACHT_MS);
    } finally {
      clearTimeout(timer);
    }
  }
  return { onderdeel: "scherm-data", ok: false, reden: "netwerkfout" };
}
