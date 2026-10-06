import { supabase } from "@/integrations/supabase/client";

export const BIJLAGE_MAX = 10 * 1024 * 1024;
const EXT_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  heic: "image/heic", heif: "image/heif", pdf: "application/pdf",
};
const TOEGESTAAN = new Set(Object.values(EXT_MIME));

/** Bepaalt het mime-type (HEIC heeft in browsers vaak geen type). Null = niet toegestaan. */
export function bijlageMime(f: File): string | null {
  if (TOEGESTAAN.has(f.type)) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? null;
}

export function controleerBijlage(f: File): string | null {
  if (!bijlageMime(f)) return `${f.name}: alleen afbeeldingen (png, jpg, webp, heic) of pdf`;
  if (f.size > BIJLAGE_MAX) return `${f.name}: groter dan 10 MB`;
  if (f.size === 0) return `${f.name}: leeg bestand`;
  return null;
}

/** Bestanden uit een plak- of sleepactie. Schermafbeeldingen krijgen een leesbare naam. */
export function bestandenUitTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const uit: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (!f) continue;
    if (!f.name || f.name === "image.png") {
      const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
      const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      uit.push(new File([f], `schermafbeelding-${stempel}.${ext}`, { type: f.type }));
    } else uit.push(f);
  }
  if (uit.length === 0 && dt.files?.length) uit.push(...Array.from(dt.files));
  return uit;
}

export async function uploadBijlagen(notitieId: string, files: File[], userId: string): Promise<string[]> {
  const fouten: string[] = [];
  for (const f of files) {
    const mime = bijlageMime(f);
    if (!mime) { fouten.push(`${f.name}: niet toegestaan`); continue; }
    const veilig = f.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80);
    const pad = `notities/${notitieId}/${crypto.randomUUID()}-${veilig}`;
    const { error: upErr } = await supabase.storage.from("klant-documenten").upload(pad, f, { contentType: mime, upsert: false });
    if (upErr) { fouten.push(`${f.name}: ${upErr.message}`); continue; }
    const { error } = await supabase.from("crm_notitie_bijlagen").insert({
      notitie_id: notitieId, storage_pad: pad, bestandsnaam: f.name, mime, grootte: f.size, geupload_door: userId,
    });
    if (error) fouten.push(`${f.name}: ${error.message}`);
  }
  return fouten;
}
