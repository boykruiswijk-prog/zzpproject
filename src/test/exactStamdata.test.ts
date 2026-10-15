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

describe("controle", () => {
  it("alleen GET, IBAN gemaskeerd, signalen", async () => {
    const { controleerRelatie } = await import("../../supabase/functions/_shared/exactStamdata");
    const { calls, ex } = nep((c) => {
      if (c.pad.startsWith("crm/Accounts")) return { results: [{ ID: ACC, Code: "  2009277", Name: "X", PaymentConditionSales: "14" }] };
      if (c.pad.startsWith("crm/BankAccounts")) return { results: [{ ID: BANK, BankAccount: "NL91ABNA0417164300", Main: true }] };
      if (c.pad.startsWith("cashflow")) return { results: [{ Reference: "SR-2009277", Main: false, BankAccount: "andere", CancellationDate: "/Date(1000)/" }] };
      if (c.pad.startsWith("salesinvoice")) return { results: [{ InvoiceNumber: 1, PaymentCondition: "14" }] };
      return { results: [] };
    });
    const r = await controleerRelatie(ex, "2009277");
    expect(calls.every((c) => c.methode === "GET")).toBe(true);
    expect(JSON.stringify(r)).not.toContain("NL91ABNA0417164300");
    expect(r.bankrekeningen[0].iban).toBe("NL91…4300");
    const s = r.signalen.join("|");
    expect(s).toContain("geen incasso");
    expect(s).toContain("ingetrokken");
    expect(s).toContain("niet Main");
    expect(s).toContain("≠ IN");
  });
});

describe("betaalconditie en mandaat_main", () => {
  const rij = { relatiecode: "1", exact_account_id: ACC };
  const mk = (cond: string | null, mand: unknown[]) => nep((c) => c.pad.startsWith("crm/Accounts")
    ? { results: [{ ID: ACC, PaymentConditionSales: cond }] } : c.methode === "PUT" ? {} : { results: mand });
  it("geen geldig mandaat: geen PUT", async () => {
    const { verwerkBetaalconditie } = await import("../../supabase/functions/_shared/exactStamdata");
    for (const mand of [[], [{ ID: BANK, Reference: "X", CancellationDate: "/Date(1000)/" }]]) {
      const { calls, ex } = mk("14", mand);
      expect((await verwerkBetaalconditie(ex, rij, true)).status).toBe("geen_mandaat");
      expect(calls.some((c) => c.methode === "PUT")).toBe(false);
    }
  });
  it("conditie al IN: geen PUT", async () => {
    const { verwerkBetaalconditie } = await import("../../supabase/functions/_shared/exactStamdata");
    const { calls, ex } = mk("IN", [{ ID: BANK, Reference: "X", Main: true }]);
    expect((await verwerkBetaalconditie(ex, rij, true)).status).toBe("al_incasso");
    expect(calls.some((c) => c.methode === "PUT")).toBe(false);
  });
  it("live met geldig mandaat: PUT alleen PaymentConditionSales", async () => {
    const { verwerkBetaalconditie } = await import("../../supabase/functions/_shared/exactStamdata");
    const { calls, ex } = mk("14", [{ ID: BANK, Reference: "X", Main: true }]);
    expect((await verwerkBetaalconditie(ex, rij, true)).status).toBe("bijgewerkt");
    expect(calls.filter((c) => c.methode === "PUT").map((c) => c.body)).toEqual([{ PaymentConditionSales: "IN" }]);
  });
  it("PUT met een ander veld wordt geweigerd", () => {
    expect(() => controleerSchrijfactie("PUT", `crm/Accounts(guid'${ACC}')`, { PaymentConditionSales: "IN", Phone: "1" })).toThrow();
    expect(() => controleerSchrijfactie("PUT", `crm/Accounts(guid'${ACC}')`, { Name: "x" })).toThrow();
    expect(() => controleerSchrijfactie("PUT", `cashflow/DirectDebitMandates(guid'${BANK}')`, { Main: true, Reference: "x" })).toThrow();
    expect(() => controleerSchrijfactie("PUT", `cashflow/DirectDebitMandates(guid'${BANK}')`, { Main: false })).toThrow();
    expect(() => controleerSchrijfactie("PUT", `cashflow/DirectDebitMandates(guid'${BANK}')`, { Main: true })).not.toThrow();
  });
  it("incassocode: stopt als IN geen incasso is", async () => {
    const { bevestigIncassoCode } = await import("../../supabase/functions/_shared/exactStamdata");
    const a = nep(() => ({ results: [{ Code: "IN", Description: "Incasso", PaymentMethod: "I" }] }));
    expect((await bevestigIncassoCode(a.ex)).code).toBe("IN");
    const b = nep(() => ({ results: [{ Code: "IN", Description: "14 dagen", PaymentMethod: "B" }] }));
    await expect(bevestigIncassoCode(b.ex)).rejects.toThrow();
  });
  it("mandaat_main: alleen bij enig geldig mandaat met Main false, PUT alleen Main", async () => {
    const { verwerkMandaatMain } = await import("../../supabase/functions/_shared/exactStamdata");
    const { calls, ex } = mk("IN", [{ ID: BANK, Reference: "SR-1", Main: false }]);
    expect((await verwerkMandaatMain(ex, rij, false)).status).toBe("proef_ok");
    expect(calls.every((c) => c.methode === "GET")).toBe(true);
    const l = mk("IN", [{ ID: BANK, Reference: "SR-1", Main: false }]);
    expect((await verwerkMandaatMain(l.ex, rij, true)).status).toBe("bijgewerkt");
    expect(l.calls.find((c) => c.methode === "PUT")?.body).toEqual({ Main: true });
  });
});

describe("doelgroep gepagineerd", () => {
  it("meer dan 1000 contracten komen allemaal in de doelgroep", async () => {
    const { alleRijen, bouwDoelgroep } = await import("../../supabase/functions/_shared/exactStamdata");
    const rijen = Array.from({ length: 2345 }, (_, i) => ({ id: String(i), ondernemingen: { id: `o${i}`, exact_relatie_code: String(2000000 + i), exact_account_id: ACC } }));
    const verzoeken: [number, number][] = [];
    // Nep-PostgREST: nooit meer dan 1000 rijen per verzoek.
    const kc = await alleRijen(async (van, tot) => { verzoeken.push([van, tot]); return { data: rijen.slice(van, Math.min(tot + 1, van + 1000)), error: null }; });
    expect(verzoeken.length).toBe(3);
    const doel = bouwDoelgroep(kc);
    expect(doel.size).toBe(2345);
    expect(doel.has("2002344")).toBe(true);
  });
  it("databasefout stopt de run", async () => {
    const { alleRijen } = await import("../../supabase/functions/_shared/exactStamdata");
    await expect(alleRijen(async () => ({ data: null, error: { message: "x" } }))).rejects.toThrow("db: x");
  });
});
