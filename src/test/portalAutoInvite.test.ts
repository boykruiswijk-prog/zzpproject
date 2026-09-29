// @vitest-environment node
import { beslisAutoUitnodiging, claimEnVerstuur } from "../../supabase/functions/_shared/portalAutoInvite";
import { landcodeVoor } from "../../supabase/functions/_shared/landcode";
import { isValidIban } from "@/lib/sepaMachtiging";

const basis = { isTest: false, email: "klant@voorbeeld.nl", exactAccountId: "acc-1", aantalPolissen: 1, aantalUitnodigingen: 0 };

describe("Automatische Mijn ZP-uitnodiging: precies één keer", () => {
  it("verstuurt als geactiveerd + polis + nooit uitgenodigd", () => {
    expect(beslisAutoUitnodiging(basis)).toEqual({ versturen: true });
  });
  it("niets als er al een uitnodiging is (tweede trigger na activatie of certificaat)", () => {
    expect(beslisAutoUitnodiging({ ...basis, aantalUitnodigingen: 1 })).toEqual({ versturen: false, reden: "al_uitgenodigd" });
  });
  it("simulatie: activatie en daarna certificaat → één verzending", () => {
    let uitnodigingen = 0; let verzonden = 0;
    const trigger = (s: Partial<typeof basis>) => {
      if (beslisAutoUitnodiging({ ...basis, ...s, aantalUitnodigingen: uitnodigingen }).versturen) { uitnodigingen++; verzonden++; }
    };
    trigger({ aantalPolissen: 0 });                       // activatie, nog geen polis
    trigger({});                                          // certificaat → laatste van de twee
    trigger({});                                          // nieuw certificaat
    expect(verzonden).toBe(1);
  });
  it("niets zonder activatie of zonder polis", () => {
    expect(beslisAutoUitnodiging({ ...basis, exactAccountId: null }).versturen).toBe(false);
    expect(beslisAutoUitnodiging({ ...basis, aantalPolissen: 0 }).versturen).toBe(false);
  });
  it("testleads alleen voor @zpzaken.nl", () => {
    expect(beslisAutoUitnodiging({ ...basis, isTest: true })).toEqual({ versturen: false, reden: "testlead" });
    expect(beslisAutoUitnodiging({ ...basis, isTest: true, email: "boy.kruiswijk+x@ZPZaken.nl" }).versturen).toBe(true);
  });
  it("testklant 5b3adabc (heeft al uitnodiging) → niets", () => {
    expect(beslisAutoUitnodiging({ isTest: true, email: "boy.kruiswijk+portaaltest@zpzaken.nl", exactAccountId: "x", aantalPolissen: 1, aantalUitnodigingen: 3 }).versturen).toBe(false);
  });
});

describe("IBAN mod-97 bij activatie", () => {
  it.each(["NL91ABNA0417164300", "BE68539007547034", "DE89370400440532013000"])("%s is geldig", (i) => {
    expect(isValidIban(i)).toBe(true);
  });
  it("ongeldig IBAN wordt geweigerd", () => {
    expect(isValidIban("BE68539007547035")).toBe(false);
  });
});

describe("Landcode voor Exact", () => {
  it("uit land of postcode", () => {
    expect(landcodeVoor("België", "2000")).toBe("BE");
    expect(landcodeVoor("", "1234 AB")).toBe("NL");
    expect(landcodeVoor(null, "2000")).toBe("BE");
    expect(landcodeVoor("Duitsland", "10115")).toBe("DE");
  });
});

describe("Claim tegen race: twee gelijktijdige aanroepen", () => {
  const maakDb = () => {
    const claims = new Set<string>();
    return {
      claims,
      // Mock van insert … on conflict do nothing: true alleen als de rij echt is ingevoegd.
      claim: async (id: string) => { await Promise.resolve(); if (claims.has(id)) return false; claims.add(id); return true; },
      release: async (id: string) => { claims.delete(id); },
    };
  };
  it("slechts één van twee gelijktijdige aanroepen verstuurt", async () => {
    const db = maakDb(); let mails = 0;
    const run = () => claimEnVerstuur({
      claim: () => db.claim("lead-1"), release: () => db.release("lead-1"),
      send: async () => { mails++; return { verzonden: true }; },
    });
    const [a, b] = await Promise.all([run(), run()]);
    expect([a.gewonnen, b.gewonnen].filter(Boolean)).toHaveLength(1);
    expect(mails).toBe(1);
    expect(db.claims.has("lead-1")).toBe(true);
  });
  it("mislukte verzending geeft de claim weer vrij", async () => {
    const db = maakDb();
    const r = await claimEnVerstuur({
      claim: () => db.claim("lead-2"), release: () => db.release("lead-2"),
      send: async () => ({ verzonden: false }),
    });
    expect(r.gewonnen).toBe(true);
    expect(db.claims.has("lead-2")).toBe(false);
  });
  it("exception bij verzenden geeft de claim vrij en gooit door", async () => {
    const db = maakDb();
    await expect(claimEnVerstuur({
      claim: () => db.claim("lead-3"), release: () => db.release("lead-3"),
      send: async () => { throw new Error("resend down"); },
    })).rejects.toThrow("resend down");
    expect(db.claims.has("lead-3")).toBe(false);
  });
});
