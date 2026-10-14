// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { beslisNieuwCertificaat } from "../../supabase/functions/_shared/certificaatRegels";
import { BRON_TEKST } from "@/lib/certificaatNummerKeuze";

const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
const mig = readdirSync("drizzle/migrations").find((f) => f.includes("ingetrokken_certificaat_vervangen"))!;
const sql = readFileSync(`drizzle/migrations/${mig}`, "utf8");

describe("nieuw certificaat na intrekken (zelfde BAV-nummer)", () => {
  it("(a) alleen ingetrokken: nieuw certificaat toegestaan", () => {
    expect(beslisNieuwCertificaat([{ certificate_number: "ZPBAV4124", status: "ingetrokken" }], false)).toEqual({ toegestaan: true, nieuwNummer: true });
    expect(BRON_TEKST.eerdere_policy_ingetrokken).toBe("eerder certificaat (ingetrokken)");
  });
  it("(b) al een geldig certificaat: Aanpassen, geen tweede geldige", () => {
    expect(beslisNieuwCertificaat([{ certificate_number: "ZPBAV4124", status: "geldig" }], false))
      .toMatchObject({ toegestaan: false, code: "bestaand_certificaat" });
    expect(sql).toMatch(/CREATE UNIQUE INDEX policies_certificate_number_geldig_key ON public\.policies \(certificate_number\) WHERE status = 'geldig'/);
    expect(sql).toMatch(/'staat_al_op_policy', g\.id IS NOT NULL/);
  });
  it("(c) nummer van een andere klant (geldig of ingetrokken) nooit hergebruiken", () => {
    expect(sql).toMatch(/Ingetrokken policy van een andere klant: nooit hergebruiken/);
    expect(sql).toMatch(/guard_policy_nummer_andere_klant/);
    expect(sql).toMatch(/ingetrokken\) certificaat van een andere klant/);
  });
  it("(d) oude PDF wordt naar versies/ gekopieerd voor de nieuwe upload", () => {
    const helper = src.slice(src.indexOf("async function bewaarIngetrokkenPdfs"), src.indexOf("async function mailCertificaat"));
    expect(helper).toMatch(/versies\/\$\{p\.certificate_number\}-v\$\{p\.versie\}-ingetrokken-/);
    expect(helper).toMatch(/storage\.from\("certificates"\)\.copy\(pad, kopie\)/);
    expect(helper).toMatch(/actie: "vervangen_door_nieuw"/);
    expect(helper).toMatch(/update\(\{ pdf_url: kopie \}\)/);
    expect(src).toMatch(/De PDF van een eerder certificaat met dit nummer is nog niet bewaard/);
    const tak = src.slice(src.indexOf("else if (body.onderneming_id)"), src.indexOf("lead_id or policy_data required"));
    expect(tak.indexOf("bewaarIngetrokkenPdfs")).toBeGreaterThan(-1);
    expect(tak.indexOf("bewaarIngetrokkenPdfs")).toBeLessThan(tak.indexOf('from("policies").insert'));
    expect(tak).not.toMatch(/mailCertificaat|resend/i);
  });
});
