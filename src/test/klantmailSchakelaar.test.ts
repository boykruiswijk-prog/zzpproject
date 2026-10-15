// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { schakelaarStaatAan } from "@/lib/klantmailTekst";

vi.stubGlobal("Deno", { env: { get: () => undefined } });

function db(rij: any) {
  const inserts: any[] = [];
  const api: any = { select: () => api, eq: () => api, maybeSingle: async () => ({ data: rij, error: null }), insert: async (r: any) => { inserts.push(r); return { error: null }; } };
  return { from: () => api, inserts };
}

describe("klantmail-schakelaar", () => {
  it("uit = nooit versturen; wacht_op_akkoord = nooit; alleen aan + goedgekeurd", () => {
    expect(schakelaarStaatAan({ actief: false, status: "goedgekeurd_boy" })).toBe(false);
    expect(schakelaarStaatAan({ actief: true, status: "wacht_op_akkoord_boy" })).toBe(false);
    expect(schakelaarStaatAan(null)).toBe(false);
    expect(schakelaarStaatAan({ actief: true, status: "goedgekeurd_boy" })).toBe(true);
  });
  it("verstuurKlantmail bij uit: geen fetch, wel logregel niet_verzonden_schakelaar_uit", async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    const { verstuurKlantmail } = await import("../../supabase/functions/_shared/klantmailSchakelaar");
    for (const rij of [{ actief: false, status: "goedgekeurd_boy" }, { actief: true, status: "wacht_op_akkoord_boy" }]) {
      const d = db({ sleutel: "x", onderwerp: "o", tekst: "t", ...rij });
      const s = await verstuurKlantmail(d, null, "test", "x", "klant@example.com", {}, { incasso_id: "1" });
      expect(s).toBe("niet_verzonden_schakelaar_uit");
      expect(d.inserts[0]).toMatchObject({ sleutel: "x", status: "niet_verzonden_schakelaar_uit" });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("seed: vier klantmails uit en wacht op akkoord Boy; byte-gelijke kopie", () => {
    const sql = readFileSync("drizzle/migrations/0144_0144_klantmails_incasso_prolongatie.sql", "utf8");
    for (const k of ["incasso_herinnering_1", "incasso_herinnering_2_aanmaning", "incasso_herinnering_3_opschorting", "prolongatie_jaarpolis"]) expect(sql).toContain(`('${k}'`);
    expect(sql).toContain("actief boolean NOT NULL DEFAULT false");
    expect(sql).toContain("status text NOT NULL DEFAULT 'wacht_op_akkoord_boy'");
    expect(sql).not.toMatch(/advies|direct gedekt|—/i);
    expect(readFileSync("src/lib/klantmailTekst.ts", "utf8")).toBe(readFileSync("supabase/functions/_shared/klantmailTekst.ts", "utf8"));
  });
});
