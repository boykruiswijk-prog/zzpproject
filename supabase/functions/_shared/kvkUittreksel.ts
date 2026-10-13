// Tijdelijk verplicht KVK-uittreksel bij het startertarief zolang de KVK API niet operationeel is (A12 aangevuld).
// Pure validatie; gedeeld door de browser (src/lib/kvkUittreksel.ts) en de server.
// deno-lint-ignore-file no-explicit-any

export const UITTREKSEL_MAX_BYTES = 10 * 1024 * 1024;
export const UITTREKSEL_LABEL = "KVK-uittreksel (bewijs dat je minder dan 12 maanden ingeschreven bent)";
export const UITTREKSEL_UITLEG = "Een uittreksel of een uitdraai van je inschrijving bij KVK (zichtbaar: KVK-nummer en datum van inschrijving).";
export const UITTREKSEL_VERPLICHT = "Voeg je KVK-uittreksel toe (pdf, jpg of png, maximaal 10 MB). Dat is nodig voor het startertarief.";
export type UittrekselMime = "application/pdf" | "image/jpeg" | "image/png";

const EXT: Record<string, UittrekselMime> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** Bestandstype op inhoud (magic bytes). */
export function mimeUitInhoud(b: Uint8Array): UittrekselMime | null {
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "image/png";
  return null;
}

/** Controle op grootte, extensie én inhoud. Geeft foutmelding of het type. */
export function controleerUittreksel(naam: string, grootte: number, kop: Uint8Array): { ok: true; mime: UittrekselMime } | { ok: false; fout: string } {
  if (!grootte) return { ok: false, fout: "Het bestand is leeg." };
  if (grootte > UITTREKSEL_MAX_BYTES) return { ok: false, fout: "Het bestand is groter dan 10 MB." };
  const ext = String(naam ?? "").toLowerCase().split(".").pop() ?? "";
  const vanExt = EXT[ext];
  if (!vanExt) return { ok: false, fout: "Alleen pdf, jpg of png is toegestaan." };
  const vanInhoud = mimeUitInhoud(kop);
  if (!vanInhoud || vanInhoud !== vanExt) return { ok: false, fout: "Het bestand is geen echte pdf, jpg of png." };
  return { ok: true, mime: vanInhoud };
}

export const extVoorMime = (m: UittrekselMime) => (m === "application/pdf" ? "pdf" : m === "image/png" ? "png" : "jpg");

/** Uploadveld nodig? Alleen bij starter en KVK API niet operationeel. */
export const uittrekselVerplicht = (starter: boolean, apiOperationeel: boolean | null | undefined) => starter && apiOperationeel !== true;

/** KVK API operationeel = schakelaar integratie_config 'kvk_api' aan EN sleutel KVK_API_KEY aanwezig. Nooit de sleutel teruggeven. */
export async function kvkApiOperationeel(admin: any): Promise<boolean> {
  const sleutel = (globalThis as any).Deno?.env.get("KVK_API_KEY");
  if (!sleutel) return false;
  const { data } = await admin.from("integratie_config").select("enabled").eq("naam", "kvk_api").maybeSingle();
  return data?.enabled === true;
}
