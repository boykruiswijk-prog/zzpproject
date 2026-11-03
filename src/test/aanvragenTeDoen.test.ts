// @vitest-environment node
import { describe, expect, it } from "vitest";
import { filterAanvragenOpTab, filterOpTab } from "@/lib/leadVlag";

const vandaag = "2026-10-23";
const aanvragen = [
  { id: "actief", status: "actief", vlag: null, aanvraag_afgerond_op: "2026-10-20T10:00:00Z" },
  { id: "actief-cert-open", status: "actief", vlag: null, aanvraag_afgerond_op: null },
  { id: "actief-gemarkeerd", status: "actief", vlag: "actie", vlag_datum: vandaag, aanvraag_afgerond_op: "2026-10-20T10:00:00Z" },
  { id: "behandeling", status: "in_behandeling", vlag: null },
  { id: "beoordelen", status: "nieuw_te_beoordelen", vlag: null },
];
describe("Aanvragen Te doen", () => {
  it("Polis actief is pas niet meer Te doen als het certificaat verstuurd is", () => {
    expect(filterAanvragenOpTab(aanvragen, "te_doen", vandaag).map(r => r.id)).toEqual(["actief-cert-open", "behandeling", "beoordelen"]);
  });
  it("Polis actief blijft in Alle", () => {
    expect(filterAanvragenOpTab(aanvragen, "alle", vandaag)).toEqual(aanvragen);
  });
  it("gemarkeerde actieve polis blijft Gemarkeerd", () => {
    expect(filterAanvragenOpTab(aanvragen, "gemarkeerd", vandaag).map(r => r.id)).toEqual(["actief-gemarkeerd"]);
  });
  it("Leads behouden de bestaande regel", () => {
    expect(filterOpTab(aanvragen, "te_doen", vandaag)).toHaveLength(5);
  });
});