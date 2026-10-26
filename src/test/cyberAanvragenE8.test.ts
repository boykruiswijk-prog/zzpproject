// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { CYBER_AKKOORD } from "../../supabase/functions/_shared/cyber";

async function route(actie: string, extra: Record<string, unknown> = {}, controleOk = true) {
  const calls: string[] = [];
  const verzoek = { id: "00000000-0000-0000-0000-000000000001", status: "akkoord_wacht_op_activatie", is_test: false, geactiveerd_op: null, policy_id: "polis", onderneming_id: "klant", lead_id: "lead", gewenste_ingangsdatum: "2026-10-23", certificaat_pad: "cyber.pdf", certificaat_mail_status: "verzonden", mail_status: "verzonden" };
  const db = { from: (table: string) => { const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === "cyber_activatie_config" ? { actief: true } : verzoek }), single: async () => ({ data: verzoek }) }; return q; }, rpc: async (name: string) => { calls.push(name); return { data: name === "cyber_certificaat_verzendklaar" ? controleOk : name.includes("mail_claim") ? null : "akkoord_wacht_op_activatie" }; } };
  let handler: (r: Request) => Promise<Response> = async () => new Response();
  const source = readFileSync("supabase/functions/cyber-toevoegen-activeren/index.ts", "utf8").replace(/^import .*;\r?\n/gm, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const names = ["createClient", "corsHeaders", "requireVerzekeringOfSupervisor", "klantOntvanger", "verstuurKlantmail", "cyberToevoegMailData", "cyberToevoegSpec", "activeerCyberKern", "isServiceTestRequest", "mailCertificaat", "cyberMailVolgorde", "cyberGateBesluit", "bouwFactuurPayload", "glUitCache", "beoordelingGeldig", "cyberDocumentControle", "Deno"];
  const values = [() => db, {}, async () => ({ userId: "ellen" }), async () => { calls.push("ontvanger"); return { email: "test@zpzaken.nl" }; }, async () => { calls.push("mail"); }, () => ({}), () => ({}), async () => { calls.push("kern"); return { status: "actief", verzoek: { ...verzoek, geactiveerd_op: "2026-10-23" }, contract: { id: "contract", cyclus: "jaar" } }; }, () => false, async () => { calls.push("certificaatmail"); }, () => {}, () => ({ toegestaan: true }), () => {}, () => {}, () => true, () => {}, { env: { get: () => "mock" }, serve: (h: typeof handler) => { handler = h; } }];
  new Function(...names, compiled)(...values);
  const r = await handler(new Request("https://example.test", { method: "POST", headers: { Authorization: "Bearer test" }, body: JSON.stringify({ id: verzoek.id, actie, akkoord: true, notitie: "Telefonisch beoordeeld", ...extra }) }));
  return { response: await r.json(), calls };
}
describe("E8 afzonderlijke aanvraagstappen", () => {
  it("versturen zonder actuele PDF-controle weigert vóór mailclaims", async () => {
    const r = await route("versturen", {}, false); expect(r.calls).toEqual(["kern", "cyber_certificaat_verzendklaar"]); expect(r.response.error).toBe("Controleer eerst het cybercertificaat");
  });
  it("reeds verstuurde mails worden niet nogmaals verstuurd", async () => {
    const r = await route("versturen"); expect(r.calls).toEqual(["kern", "cyber_certificaat_verzendklaar", "ontvanger", "cyber_toevoegen_mail_claim"]); expect(r.response.mail).toBe("verzonden");
  });
  it("akkoord beoordeelt alleen, geen activatie/document/klantmail", async () => {
    const r = await route("beoordelen"); expect(r.calls).toEqual(["cyber_toevoegen_beoordelen"]); expect(r.response.mail).toBe("niet_verzonden_beoordeling");
  });
  it("activeren maakt contract maar claimt geen mail en maakt geen document", async () => {
    const r = await route("activeren"); expect(r.calls).toEqual(["kern"]); expect(r.response.contract_id).toBe("contract"); expect(r.response.mail).toBe("wacht_op_handmatig_versturen");
  });
  it("certificaat aanmaken bij bestaand document verstuurt niets", async () => {
    const r = await route("certificaat"); expect(r.calls).toEqual(["kern", "ontvanger"]); expect(r.response.mail).toBe("wacht_op_controle_en_versturen");
  });
  it("vaste klantakkoord blijft letterlijk dagelijks opzegbaar", () => {
    expect(CYBER_AKKOORD).toBe("Ik begrijp dat cyber dagelijks opzegbaar is en dat ik al betaalde premie voor cyber bij opzeggen niet terugkrijg. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.");
  });
});
describe("E8 SQL documentcontrole", () => {
  it("Ellen controleert actuele PDF, ander teamlid of gewijzigd pad kan niet verzenden", async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$select '00000000-0000-0000-0000-000000000002'::uuid$$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$select '{"aal":"aal2","email":"ellen.baars@zpzaken.nl"}'::jsonb$$;
      CREATE FUNCTION public.is_supervisor_or_admin(uuid) RETURNS boolean LANGUAGE sql AS $$select true$$;
      CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$select true$$;
      CREATE TABLE cyber_toevoeg_verzoeken(id uuid,lead_id uuid,is_test boolean,geactiveerd_op timestamptz,certificaat_pad text,certificaat_gecontroleerd_pad text,certificaat_gecontroleerd_op timestamptz,certificaat_gecontroleerd_door uuid);
      CREATE TABLE activiteiten_log(actie_type text,omschrijving text,uitgevoerd_door uuid,lead_id uuid,is_test boolean);`);
      const sql = readFileSync("drizzle/migrations/0186_cyber_aanvragen_e8_werkroute.sql", "utf8");
      await db.exec(sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.cyber_certificaat_controleren"), sql.indexOf("DO $wire$")));
      const id = "00000000-0000-0000-0000-000000000001";
      await db.query(`INSERT INTO cyber_toevoeg_verzoeken(id,is_test,geactiveerd_op,certificaat_pad) VALUES($1,true,now(),'actueel.pdf')`, [id]);
      await expect(db.query(`SELECT cyber_certificaat_verzendklaar($1)`, [id])).rejects.toThrow(/Controleer eerst/);
      await db.query(`SELECT cyber_certificaat_controleren($1,'actueel.pdf')`, [id]);
      expect((await db.query<{ok: boolean}>(`SELECT cyber_certificaat_verzendklaar($1) ok`, [id])).rows[0].ok).toBe(true);
      await db.exec(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$select '{"aal":"aal2","email":"ander@zpzaken.nl"}'::jsonb$$`);
      await expect(db.query(`SELECT cyber_certificaat_verzendklaar($1)`, [id])).rejects.toThrow(/Alleen Ellen/);
      await db.exec(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$select '{"aal":"aal2","email":"ellen.baars@zpzaken.nl"}'::jsonb$$; UPDATE cyber_toevoeg_verzoeken SET certificaat_pad='nieuw.pdf';`);
      await expect(db.query(`SELECT cyber_certificaat_verzendklaar($1)`, [id])).rejects.toThrow(/Controleer eerst/);
    } finally { await db.close(); }
  });
});