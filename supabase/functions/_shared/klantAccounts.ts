// Mijn ZP: welke Exact-accounts horen bij deze ingelogde klant?
// Route 1: policies.user_id → leads.exact_account_id (bestaande polisklanten).
// Route 2: genormaliseerd e-mailadres → personen → persoon_onderneming → ondernemingen.exact_account_id.
// deno-lint-ignore-file no-explicit-any
export const PORTAL_FACTUREN_VANAF = "2026-10-17";

export async function accountIdsVoorGebruiker(admin: any, userId: string, email: string | null | undefined): Promise<string[]> {
  const ids = new Set<string>();
  const { data: pols } = await admin.from("policies").select("lead_id").eq("user_id", userId).not("lead_id", "is", null);
  const leadIds = [...new Set((pols ?? []).map((p: any) => p.lead_id).filter(Boolean))];
  if (leadIds.length) {
    const { data: leads } = await admin.from("leads").select("exact_account_id").in("id", leadIds).not("exact_account_id", "is", null);
    for (const l of leads ?? []) ids.add(String(l.exact_account_id));
  }
  const norm = String(email ?? "").trim().toLowerCase();
  if (norm) {
    const { data: pers } = await admin.from("personen").select("id").eq("genormaliseerd_email", norm).eq("is_test", false);
    const pIds = (pers ?? []).map((p: any) => p.id);
    if (pIds.length) {
      const { data: po } = await admin.from("persoon_onderneming").select("onderneming_id").in("persoon_id", pIds);
      const oIds = [...new Set((po ?? []).map((x: any) => x.onderneming_id))];
      if (oIds.length) {
        const { data: ond } = await admin.from("ondernemingen").select("exact_account_id")
          .in("id", oIds).not("exact_account_id", "is", null).is("facturatie_blokkade", null);
        for (const o of ond ?? []) ids.add(String(o.exact_account_id));
      }
    }
  }
  return [...ids].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
}
