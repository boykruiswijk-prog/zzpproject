// @vitest-environment node
import { beslisAutoUitnodiging } from "../../supabase/functions/_shared/portalAutoInvite";
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
