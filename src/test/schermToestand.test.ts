// @vitest-environment node
import { describe, expect, it } from "vitest";
import { bepaalToestand, bouwSchermPayload } from "../../supabase/functions/_shared/schermAnonimiseer";
import { periodeTekst, toestandLabel } from "@/components/scherm/schermModel";

const nu = new Date("2026-10-12T06:55:00Z"); // 08:55 NL
const min = (m: number) => new Date(nu.getTime() - m * 60_000).toISOString();

describe("toestand per werkplek", () => {
  it("lopende bezig-rij = aan het werk", () => expect(bepaalToestand({ lopend: true, laatst_actief_op: min(25) }, nu)).toBe("aan_het_werk"));
  it("laatste actie < 10 min = aan het werk", () => expect(bepaalToestand({ laatst_actief_op: min(4), laatste_status: "klaar" }, nu)).toBe("aan_het_werk"));
  it("vandaag maar > 10 min = stand-by", () => expect(bepaalToestand({ laatst_actief_op: "2026-10-12T05:14:00Z", laatste_status: "klaar" }, nu)).toBe("stand_by"));
  it("niet vandaag = rust", () => expect(bepaalToestand({ laatst_actief_op: "2026-10-11T19:00:00Z" }, nu)).toBe("rust"));
  it("geen activiteit = rust", () => expect(bepaalToestand(undefined, nu)).toBe("rust"));
  it("laatste actie fout = storing", () => expect(bepaalToestand({ laatst_actief_op: min(60), laatste_status: "fout" }, nu)).toBe("storing"));
  it("onbekend (vastgelopen bezig-rij) is geen aan het werk", () => expect(bepaalToestand({ lopend: false, laatst_actief_op: min(40), laatste_status: "onbekend" }, nu)).toBe("stand_by"));
});

describe("labels", () => {
  it("stand-by toont NL-tijd", () => expect(toestandLabel({ vandaag: 2, laatste_status: "klaar", toestand: "stand_by", laatst_actief_op: "2026-10-12T05:14:00Z" })).toBe("stand-by, laatst actief 07:14"));
  it("storing", () => expect(toestandLabel({ vandaag: 0, laatste_status: "fout", toestand: "storing" })).toBe("aandacht nodig"));
  it("agentperiode", () => expect(periodeTekst({ agent: true, gestart_op: "2026-10-12T04:30:00Z", afgerond_op: "2026-10-12T04:42:00Z" })).toBe("06:30-06:42 (12 min)"));
  it("geen periode zonder agent", () => expect(periodeTekst({ agent: false, gestart_op: "x", afgerond_op: "y" })).toBeNull());
});

describe("payload", () => {
  it("lopende tekst gaat door de privacyfilter en bron-id lekt niet", () => {
    const p = bouwSchermPayload({
      werkstand: { ads: { lopend: false, laatst_actief_op: "2026-10-12T05:14:00Z", laatste_status: "klaar", lopende_tekst: "Mail naar jan@voorbeeld.nl", duur_vandaag_min: 3 } },
      activiteit: [{ id: "a1", station: "ads", actie: "x", tekst: "Ads-agent klaar", status: "klaar", tijd: "2026-10-12T04:42:00Z" }],
      perioden: [{ id: "a1", gestart_op: "2026-10-12T04:30:00Z", afgerond_op: "2026-10-12T04:42:00Z", agent: true, bron: "agent:cse_geheim" }],
    }, nu);
    expect(p.stations.ads.toestand).toBe("stand_by");
    expect(p.stations.ads.lopende_tekst).not.toContain("@");
    expect(p.stations.ads.duur_vandaag_min).toBe(3);
    expect(JSON.stringify(p)).not.toContain("cse_geheim");
    expect(p.activiteit[0].agent).toBe(true);
  });
});
