// @vitest-environment node
import { beveiligd, controleerSchrijfactie, verwerkMandaat, verwerkTelefoon, type Exact } from "../../supabase/functions/_shared/exactStamdata";

const ACC = "11111111-1111-1111-1111-111111111111";
const BANK = "22222222-2222-2222-2222-222222222222";
type Call = { methode: string; pad: string; body?: Record<string, unknown> };

function nep(antwoorden: (c: Call) => unknown) {
  const calls: Call[] = [];
  const ex: Exact = async (methode, pad, body) => {
    calls.push({ methode, pad, body });
    return { ok: true, status: 200, data: { d: antwoorden({ methode, pad, body }) }, tekst: "" };
  };
  return { calls, ex: beveiligd(ex) };
}
const acc = (phone: string | null) => ({ results: [{ ID: ACC, Name: "Test BV", Phone: phone }] });

describe("telefoon", () => {
  it("Phone gevuld in Exact: overslaan, nooit een PUT (proef en live)", async () => {
    for (const live of [false, true]) {
      const { calls, ex } = nep(() => acc("0201234567"));
      const p = await verwerkTelefoon(ex, { id: "1", relatiecode: "2009362", telefoon: "0612345678", status: "proef_ok" }, live);
      expect(p.status).toBe("overgeslagen_heeft_al");
      expect(p.exact_telefoon_oud).toBe("0201234567");
      expect(calls.every((c) => c.methode === "GET")).toBe(true);
    }
  });
  it("proef: alleen GET, status proef_ok", async () => {
    const { calls, ex } = nep(() => acc(null));
    const p = await verwerkTelefoon(ex, { id: "1", relatiecode: "1", telefoon: "0612345678", status: "nieuw" }, false);
    expect(p.status).toBe("proef_ok");
    expect(calls.map((c) => c.methode)).toEqual(["GET"]);
  });
  it("live: hercontrole, daarna PUT met alleen Phone", async () => {
    const { calls, ex } = nep((c) => (c.methode === "GET" ? acc("  ") : {}));
    const p = await verwerkTelefoon(ex, { id: "1", relatiecode: "1", telefoon: "0612345678", status: "proef_ok" }, true);
    expect(p.status).toBe("bijgewerkt");
    expect(calls.map((c) => c.methode)).toEqual(["GET", "GET", "PUT"]);
    expect(calls[2].body).toEqual({ Phone: "0612345678" });
  });
  it("live: inmiddels gevuld bij hercontrole → geen PUT", async () => {
    let n = 0;
    const { calls, ex } = nep(() => (n++ === 0 ? acc(null) : acc("0201111111")));
    const p = await verwerkTelefoon(ex, { id: "1", relatiecode: "1", telefoon: "06", status: "proef_ok" }, true);
    expect(p.status).toBe("overgeslagen_heeft_al");
    expect(calls.some((c) => c.methode === "PUT")).toBe(false);
  });
  it("niet gevonden", async () => {
    const { ex } = nep(() => ({ results: [] }));
    expect((await verwerkTelefoon(ex, { id: "1", relatiecode: "9", telefoon: "06", status: "nieuw" }, false)).status).toBe("niet_gevonden");
  });
});

describe("machtigingen", () => {
  const rij = { id: "m", relatiecode: "2009362", iban: "NL91 ABNA 0417 1643 00", kenmerk: "ZP123", ondertekend_op: "2024-05-01" };
  it("mandaat met hetzelfde kenmerk bestaat al: overslaan, geen POST", async () => {
    for (const live of [false, true]) {
      const { calls, ex } = nep((c) => c.pad.startsWith("cashflow/DirectDebitMandates?")
        ? { results: [{ ID: "x", Reference: " ZP123 " }] } : acc(null));
      const p = await verwerkMandaat(ex, rij, live);
      expect(p.status).toBe("overgeslagen_bestaat_al");
      expect(calls.some((c) => c.methode !== "GET")).toBe(false);
    }
  });
  it("proef: alleen GET's, bankrekening aanmaken gepland", async () => {
    const { calls, ex } = nep((c) => c.pad.startsWith("crm/Accounts") ? acc(null) : { results: [] });
    const p = await verwerkMandaat(ex, rij, false);
    expect(p.status).toBe("proef_ok");
    expect(p.exact_bankrekening_actie).toBe("aanmaken");
    expect(calls.every((c) => c.methode === "GET")).toBe(true);
  });
  it("live zonder mandaat en zonder rekening: POST rekening (Main niet overschreven) en mandaat met Main true", async () => {
    const { calls, ex } = nep((c) => {
      if (c.methode === "POST" && c.pad === "crm/BankAccounts") return { ID: BANK };
      if (c.methode === "POST") return { ID: "33333333-3333-3333-3333-333333333333" };
      if (c.pad.startsWith("crm/BankAccounts")) return { results: [{ ID: "44444444-4444-4444-4444-444444444444", BankAccount: "NL00OTHER", Main: true }] };
      return c.pad.startsWith("crm/Accounts") ? acc(null) : { results: [] };
    });
    const p = await verwerkMandaat(ex, rij, true);
    expect(p.status).toBe("bijgewerkt");
    const posts = calls.filter((c) => c.methode === "POST");
    expect(posts[0].body).toMatchObject({ Account: ACC, BankAccount: "NL91ABNA0417164300", Main: false });
    expect(posts[1].body).toEqual({ Account: ACC, BankAccount: BANK, Reference: "ZP123", SignatureDate: "2024-05-01T00:00:00", Type: 0, PaymentType: 1, Main: true });
  });
  it("live met bestaande rekening en ander mandaat: geen rekening-POST, geen Main", async () => {
    const { calls, ex } = nep((c) => {
      if (c.methode === "POST") return { ID: "33333333-3333-3333-3333-333333333333" };
      if (c.pad.startsWith("crm/BankAccounts")) return { results: [{ ID: BANK, BankAccount: "nl91abna0417164300" }] };
      if (c.pad.startsWith("cashflow")) return { results: [{ ID: "y", Reference: "OUD" }] };
      return acc(null);
    });
    const p = await verwerkMandaat(ex, rij, true);
    expect(p.exact_bankrekening_actie).toBe("bestaand");
    const posts = calls.filter((c) => c.methode === "POST");
    expect(posts.map((c) => c.pad)).toEqual(["cashflow/DirectDebitMandates"]);
    expect(posts[0].body).not.toHaveProperty("Main");
  });
});

describe("allowlist", () => {
  it("staat alleen PUT Phone en de twee POST's toe", () => {
    expect(() => controleerSchrijfactie("PUT", `crm/Accounts(guid'${ACC}')`, { Phone: "1" })).not.toThrow();
    expect(() => controleerSchrijfactie("PUT", `crm/Accounts(guid'${ACC}')`, { Phone: "1", Name: "x" })).toThrow();
    expect(() => controleerSchrijfactie("PUT", `crm/BankAccounts(guid'${ACC}')`, { Phone: "1" })).toThrow();
    expect(() => controleerSchrijfactie("POST", "salesinvoice/SalesInvoices", {})).toThrow();
    expect(() => controleerSchrijfactie("DELETE", "crm/BankAccounts", {})).toThrow();
    expect(() => controleerSchrijfactie("POST", "crm/BankAccounts", {})).not.toThrow();
  });
});
