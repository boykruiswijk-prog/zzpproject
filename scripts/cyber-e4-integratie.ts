// Run only in a managed server test runtime. Never fetch, print or persist the service credential.
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { activeerCyberKern } from "../supabase/functions/_shared/cyberActivatieKern.ts";
import { cyberToevoegSpec } from "../supabase/functions/_shared/cyberToevoegenActivatie.ts";

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) throw new Error("BLOCKED: managed service identity unavailable; no database evidence generated");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const ids = Deno.args;
if (ids.length !== 2 || ids.some(id => !/^[a-f0-9-]{36}$/i.test(id))) throw new Error("Supply exactly one annual and one monthly marked test request ID");
async function read(table: string, col: string, value: string) {
  const { data, error } = await db.from(table).select("*").eq(col, value).order("id");
  if (error) throw new Error(`Read failed: ${table}`);
  return data ?? [];
}
for (const [index, id] of ids.entries()) {
  const requests = await read("cyber_toevoeg_verzoeken", "id", id);
  const r = requests[0];
  const [policies, leads, companies] = await Promise.all([
    read("policies", "id", r?.policy_id), read("leads", "id", r?.lead_id), read("ondernemingen", "id", r?.onderneming_id),
  ]);
  if (!r?.is_test || !policies[0]?.is_test || !leads[0]?.is_test || !companies[0]?.is_test || !leads[0]?.email?.endsWith("@zpzaken.nl")) throw new Error("Test-only guard rejected fixture");
  const bav = (await read("klant_contracten", "onderneming_id", r.onderneming_id)).filter(x => x.product === "bav_avb");
  const cyclus = index === 0 ? "jaar" : "maand";
  if (bav.length !== 1 || bav[0].cyclus !== cyclus) throw new Error("Fixture BAV cycle mismatch");
  const planningBefore = await read("factuur_planning", "klant_contract_id", bav[0].id);
  const { data: countBefore, error: countBeforeError } = await db.rpc("tel_netto_groei", { _toon_test: true, _vanaf: r.gewenste_ingangsdatum });
  if (countBeforeError) throw new Error("Participant count read failed");
  const first = await activeerCyberKern(db, id, "E4 integration test, no mail or Exact", true);
  const second = await activeerCyberKern(db, id, "E4 integration test repeat, no mail or Exact", true);
  const contracts = await read("klant_contracten", "cyber_toevoeg_verzoek_id", id);
  const c = contracts[0];
  if (contracts.length !== 1 || first.contract?.id !== second.contract?.id || !c?.is_test || c.cyclus !== cyclus || Number(c.bedrag_per_periode) !== (cyclus === "jaar" ? 250 : 27.5) || c.begin_datum !== r.gewenste_ingangsdatum || !second.verzoek.geactiveerd_op) throw new Error("Activation/idempotency failed");
  const spec = cyberToevoegSpec(r.gewenste_ingangsdatum, cyclus);
  if (c.cyber_ingangsdatum !== spec.cyber_ingangsdatum || c.cyber_einddatum !== spec.cyber_einddatum) throw new Error("Independent twelve-month term failed");
  const bavAfter = (await read("klant_contracten", "onderneming_id", r.onderneming_id)).filter(x => x.product === "bav_avb");
  if (JSON.stringify(bavAfter) !== JSON.stringify(bav) || JSON.stringify(await read("factuur_planning", "klant_contract_id", bav[0].id)) !== JSON.stringify(planningBefore)) throw new Error("BAV changed");
  const { data: candidates, error } = await db.rpc("facturatie_testcontract", { _id: c.id, _van: c.begin_datum, _tot: c.begin_datum });
  if (error || candidates?.length !== 1 || Number(candidates[0].bedrag) !== (cyclus === "jaar" ? 250 : 27.5) || candidates[0].gl_code !== "8003" || candidates[0].itemcode !== (cyclus === "jaar" ? "102J" : "102M")) throw new Error("Planner failed");
  if (candidates[0].periode_eind !== spec.periode_eind) throw new Error("Planner period failed");
  const { data: countAfter, error: countAfterError } = await db.rpc("tel_netto_groei", { _toon_test: true, _vanaf: r.gewenste_ingangsdatum });
  if (countAfterError || Number(countAfter?.cumulatief?.instroom) - Number(countBefore?.cumulatief?.instroom) !== (r.geactiveerd_op ? 0 : 1)) throw new Error("Participant count integration failed (fixture start must be today or earlier)");
  console.log(JSON.stringify({ request_id: id, contract_id: c.id, cyclus, one_contract: true, idempotent: true, bav_byte_equal: true, candidate: candidates[0], exact_writes: 0, mails: 0 }));
}