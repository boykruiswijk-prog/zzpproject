import { supabase } from "@/integrations/supabase/client";

export type Contactpersoon = { id: string; voornaam: string | null; achternaam: string | null; email_weergave: string | null; telefoon: string | null };

/** Read the same person records that crm_gegevens_wijzigen edits, following merged cards. */
export async function laadKlantContactgegevens(ondernemingIds: string[], persoonIds: string[]) {
  const canoniek = new Map(ondernemingIds.map((id) => [id, id]));
  const doelen = new Map<string, string | null>();
  const bezocht = new Set<string>();
  let ids = [...new Set(ondernemingIds)];
  while (ids.length) {
    ids.forEach((id) => bezocht.add(id));
    const { data, error } = await supabase.from("ondernemingen").select("id,samengevoegd_naar").in("id", ids);
    if (error) throw error;
    const volgende = new Set<string>();
    for (const o of data ?? []) {
      doelen.set(o.id, o.samengevoegd_naar);
      if (o.samengevoegd_naar && !bezocht.has(o.samengevoegd_naar)) volgende.add(o.samengevoegd_naar);
    }
    ids = [...volgende];
  }
  for (const bron of ondernemingIds) {
    const keten = new Set<string>();
    let doel = bron;
    while (doelen.get(doel)) {
      if (keten.has(doel)) throw new Error("Samenvoeging van klantkaarten bevat een kringverwijzing.");
      keten.add(doel);
      const volgende = doelen.get(doel);
      if (!volgende) break;
      doel = volgende;
    }
    canoniek.set(bron, doel);
  }
  const ondernemingIdsCanoniek = [...new Set(canoniek.values())];
  const contactIds = new Set(persoonIds);
  if (ondernemingIdsCanoniek.length) {
    const { data, error } = await supabase.from("persoon_onderneming").select("persoon_id").in("onderneming_id", ondernemingIdsCanoniek);
    if (error) throw error;
    for (const koppeling of data ?? []) contactIds.add(koppeling.persoon_id);
  }
  let personen: Contactpersoon[] = [];
  if (contactIds.size) {
    const { data, error } = await supabase.from("personen").select("id,voornaam,achternaam,email_weergave,telefoon").in("id", [...contactIds]).order("id");
    if (error) throw error;
    personen = data ?? [];
  }
  return { personen, canoniek };
}

export function klantContactwaarden(personen: Contactpersoon[], leads: { email?: string | null; telefoon?: string | null }[]) {
  // Legacy cards without a linked person retain their read-only lead fallback.
  const bron = personen.length ? personen.map((p) => ({ email: p.email_weergave, telefoon: p.telefoon })) : leads;
  const uniek = (waarden: (string | null | undefined)[]) => [...new Set(waarden.map((v) => v?.trim()).filter((v): v is string => Boolean(v)))];
  return { emails: uniek(bron.map((p) => p.email)), telefoons: uniek(bron.map((p) => p.telefoon)) };
}