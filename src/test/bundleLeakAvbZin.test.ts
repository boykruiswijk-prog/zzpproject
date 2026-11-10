import { describe, it, expect } from "vitest";
import { onverwachteBedragen } from "../../scripts/bundleLeak";

describe("AVB-dekkingszin op /bav-zzp", () => {
  it("staat '€ 2.500.000 per aanspraak voor de AVB' toe", () => {
    expect(onverwachteBedragen("€ 2.500.000 per aanspraak voor de AVB")).toEqual([]);
  });
  it("blokkeert het bedrag zonder AVB-label", () => {
    expect(onverwachteBedragen("€ 2.500.000 per aanspraak")).toEqual(["2.500.000"]);
  });
  it("staat alleen de exacte AVB-tabelrij toe", () => {
    expect(onverwachteBedragen('["AVB per aanspraak","€ 2.500.000"]')).toEqual([]);
    expect(onverwachteBedragen('["Cyber per aanspraak","€ 2.500.000"]')).toEqual(["2.500.000"]);
    expect(onverwachteBedragen('["AVB per aanspraak","€ 2.500.000"];cyber:{maximum:2500000}')).toEqual(["2500000"]);
  });
});
