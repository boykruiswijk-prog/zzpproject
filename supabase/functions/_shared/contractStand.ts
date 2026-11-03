// Gedeelde regel: zodra een planningsregel op 'verwerkt' gaat, lopen gefactureerd_tm en
// volgende_factuurdatum van het contract mee. Gebruikt door factuur-planner en exact-concept-controle.
// Nooit terug in de tijd: een latere bestaande stand blijft staan (per periode maximaal één factuur).

export function dagNa(datum: string): string {
  return new Date(new Date(`${datum}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
}

export function nieuweContractStand(huidigTm: string | null | undefined, periodeEind: string):
  { gefactureerd_tm: string; volgende_factuurdatum: string } | null {
  if (huidigTm && huidigTm >= periodeEind) return null;
  return { gefactureerd_tm: periodeEind, volgende_factuurdatum: dagNa(periodeEind) };
}

// deno-lint-ignore no-explicit-any
export async function werkContractStandBij(admin: any, p: { id: string; klant_contract_id: string; periode_eind: string }, bron: string): Promise<boolean> {
  const { data: k } = await admin.from("klant_contracten").select("gefactureerd_tm").eq("id", p.klant_contract_id).single();
  const stand = nieuweContractStand(k?.gefactureerd_tm, p.periode_eind);
  if (!stand) return false;
  await admin.from("klant_contracten").update({ ...stand, gefactureerd_tm_bron: "planner" }).eq("id", p.klant_contract_id);
  await admin.from("sensitive_audit_log").insert({ target_table: "klant_contracten", target_id: p.klant_contract_id, actie: "planner_verwerkt", veld: "gefactureerd_tm", oude_waarde: k?.gefactureerd_tm ?? null, nieuwe_waarde: p.periode_eind, details: { planning_id: p.id, bron } });
  return true;
}
