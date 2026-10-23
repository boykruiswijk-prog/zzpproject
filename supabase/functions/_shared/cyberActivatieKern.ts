// A server-only dependency-injected core. Human callers still go through the MFA handler.
// deno-lint-ignore-file no-explicit-any
export async function activeerCyberKern(db: any, id: string, notitie: string, test = false) {
  const { data: status, error } = await db.rpc("cyber_toevoegen_activeren_intern", {
    _id: id, _notitie: notitie, _test: test,
  });
  if (error) throw new Error(error.message);
  const { data: verzoek, error: readError } = await db.from("cyber_toevoeg_verzoeken").select("*").eq("id", id).single();
  if (readError || !verzoek) throw new Error("Cyberverzoek niet teruggelezen");
  if (status !== "actief") return { status, verzoek, contract: null };
  const { data: contract, error: contractError } = await db.from("klant_contracten").select("*").eq("id", verzoek.contract_id).single();
  if (contractError || !contract) throw new Error("Cybercontract niet teruggelezen");
  return { status, verzoek, contract };
}