import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { NPS_ONDERWERP, npsHtml } from "../../supabase/functions/_shared/npsMail";

const html = (voornaam: string | null) => npsHtml({ voornaam, token: "a".repeat(48), paginaUrl: "https://zpzaken.nl/nps", afmeldUrl: "https://zpzaken.nl/afmelden?token=x" });

describe("NPS-verzoek A22", () => {
  it("onderwerp exact", () => expect(NPS_ONDERWERP).toBe("Eén vraag van Ellen"));
  it("aanhef met en zonder voornaam", () => {
    expect(html("Sam")).toContain("<p style=\"margin:0 0 16px\">Hoi Sam,</p>");
    expect(html(null)).toContain("<p style=\"margin:0 0 16px\">Hoi,</p>");
  });
  it("elf scoreknoppen 0 t/m 10", () => {
    for (let i = 0; i <= 10; i++) expect(html("Sam")).toContain(`&amp;s=${i}"`);
    expect(html("Sam")).not.toContain("&amp;s=11\"");
  });
  it("geen review-gating: nergens een Google-reviewlink", () => {
    expect(html("Sam")).not.toMatch(/google/i);
    expect(readFileSync("src/pages/Nps.tsx", "utf8")).not.toMatch(/google|writereview/i);
  });
  it("schakelaar staat standaard uit en verzending controleert hem", () => {
    expect(readFileSync("drizzle/migrations/0204_nps_a22.sql", "utf8")).toContain("nps_actief boolean NOT NULL DEFAULT false");
    expect(readFileSync("supabase/functions/nps-verzoeken/index.ts", "utf8")).toContain('cfg?.nps_actief !== true');
  });
  it("lage score is 0 t/m 6 en maakt geen dubbele open taak", () => {
    const sql = readFileSync("drizzle/migrations/0204_nps_a22.sql", "utf8");
    expect(sql).toContain("IF _score <= 6 AND NOT EXISTS");
    expect(sql).toContain("t.soort = 'nps_laag_bellen' AND t.status = 'open'");
  });
});
