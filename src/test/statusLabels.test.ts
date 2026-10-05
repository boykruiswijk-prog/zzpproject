import { describe, it, expect } from "vitest";
import { statusLabel, LEAD_STATUS_LABELS } from "@/lib/statusLabels";

describe("statusLabel", () => {
  it("geeft leesbare Nederlandse labels", () => {
    expect(statusLabel("nieuw_te_beoordelen")).toBe("Te beoordelen");
    expect(statusLabel("actief")).toBe("Polis actief");
    expect(statusLabel("gepauzeerd")).toBe("Gepauzeerd");
    expect(statusLabel("nieuw")).toBe("Nieuw");
    expect(statusLabel("")).toBe("—");
    expect(statusLabel("iets_onbekends")).toBe("Iets onbekends");
  });
  it("geen ruwe waarden met underscore in de leadlabels", () => {
    for (const v of Object.values(LEAD_STATUS_LABELS)) expect(v).not.toContain("_");
  });
});
