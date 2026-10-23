// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { activeerCyberKern } from "../../supabase/functions/_shared/cyberActivatieKern";

describe("cyber coordinator core", () => {
  it("uses the test-only service RPC and reads the actual linked contract", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "actief", error: null });
    const contract = { id: "contract-1", cyclus: "jaar", bedrag_per_periode: 250 };
    const db = { rpc, from: (table: string) => {
      const q = { select: () => q, eq: () => q, single: async () => ({ data: table === "klant_contracten" ? contract : { id: "request-1", contract_id: "contract-1" }, error: null }) };
      return q;
    } };
    const result = await activeerCyberKern(db, "request-1", "Gemarkeerde testpolis", true);
    expect(rpc).toHaveBeenCalledWith("cyber_toevoegen_activeren_intern", { _id: "request-1", _notitie: "Gemarkeerde testpolis", _test: true });
    expect(result.contract).toBe(contract);
    expect(result.contract.bedrag_per_periode).toBe(250);
  });
  it("release wait cannot read or create a contract", async () => {
    const tables: string[] = [];
    const db = { rpc: vi.fn().mockResolvedValue({ data: "akkoord_wacht_op_activatie", error: null }), from: (table: string) => {
      tables.push(table);
      const q = { select: () => q, eq: () => q, single: async () => ({ data: { id: "request-1" }, error: null }) };
      return q;
    } };
    expect((await activeerCyberKern(db, "request-1", "Team approved request")).contract).toBeNull();
    expect(tables).toEqual(["cyber_toevoeg_verzoeken"]);
  });
  it("permission failures stop the core", async () => {
    const db = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "geen toegang" } }), from: vi.fn() };
    await expect(activeerCyberKern(db, "request-1", "Gemarkeerde testpolis", true)).rejects.toThrow("geen toegang");
    expect(db.from).not.toHaveBeenCalled();
  });
});