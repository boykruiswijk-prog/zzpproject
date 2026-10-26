// @vitest-environment node
import { describe, it, expect } from "vitest";
import { cyberBeoordelingFout, cyberFunctieFout } from "../lib/cyberBeoordeling";
import { CYBER_AKKOORD } from "../../supabase/functions/_shared/cyber";
import { cyberAkkoordSql, cyberToevoegenAkkoordSql } from "../../scripts/cyberAkkoordSql";

describe("cyberbeoordeling 26 oktober", () => {
  it("lege beoordeling wordt vóór de goedkeuractie geweigerd", () => {
    expect(cyberBeoordelingFout("")).not.toBeNull();
    expect(cyberBeoordelingFout("Telefonisch contact")).toBeNull();
  });
  it("toont letterlijke 400-response in plaats van SDK HTTP-fout", async () => {
    const r = await cyberFunctieFout({ message: "Edge Function returned a non-2xx status code", context: new Response(JSON.stringify({ error: "Ongeldige beoordeling" }), { status: 400 }) });
    expect(r.message).toBe("Ongeldige beoordeling");
  });
  it("beide nieuwe SQL-bewijsroutes gebruiken hetzelfde akkoord", () => {
    expect(cyberAkkoordSql()).toContain(CYBER_AKKOORD);
    expect(cyberToevoegenAkkoordSql()).toContain(CYBER_AKKOORD);
    expect(CYBER_AKKOORD).toContain("looptijd van 12 maanden");
    expect(CYBER_AKKOORD).not.toContain("cyber dagelijks opzegbaar");
  });
});