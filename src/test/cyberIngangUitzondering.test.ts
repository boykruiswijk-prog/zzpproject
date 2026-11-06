import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cyberVerzoekFout } from "@/lib/cyberToevoegen";

const sql = readFileSync("drizzle/migrations/0255_cyber_ingang_uitzondering.sql", "utf8");
const ok = { a: false, b: true, c: true, d: true, e: false, f: false };
const nu = new Date("2026-11-06T12:00:00Z");

describe("uitzondering ingangsdatum cyber (besluit Boy 6-11-2026)", () => {
  it("uitzondering geldt alleen per onderneming en alleen voor teamrollen", () => {
    expect(sql).toMatch(/onderneming_id uuid PRIMARY KEY/);
    expect(sql).toMatch(/JOIN public\.cyber_ingang_uitzonderingen x ON x\.onderneming_id=p\.onderneming_id/);
    expect(sql).toMatch(/is_supervisor_or_admin\(auth\.uid\(\)\) OR public\.has_role\(auth\.uid\(\),'verzekering'\)\)\s*\) t;/);
    expect(sql).toMatch(/CHECK \(length\(btrim\(reden\)\) >= 10\)/);
    expect(sql).not.toMatch(/GRANT[^;]*(anon|authenticated)/);
  });
  it("team mag 22-10-2026 kiezen als de uitzondering die datum geeft", () => {
    expect(cyberVerzoekFout(ok, "2026-10-22", true, true, "Besluit Boy 6-11-2026: uitzondering ingangsdatum", nu, "2026-10-22")).toBeNull();
  });
  it("zonder uitzondering blijft de standaardgrens morgen", () => {
    expect(cyberVerzoekFout(ok, "2026-10-22", true, true, "Besluit Boy 6-11-2026: uitzondering ingangsdatum", nu, null)).not.toBeNull();
    expect(cyberVerzoekFout(ok, "2026-10-22", true, false, "", nu, "2026-10-22")).not.toBeNull();
  });
  it("vóór de uitzonderingsdatum wordt geweigerd", () => {
    expect(cyberVerzoekFout(ok, "2026-10-21", true, true, "Besluit Boy 6-11-2026: uitzondering ingangsdatum", nu, "2026-10-22")).not.toBeNull();
  });
});
