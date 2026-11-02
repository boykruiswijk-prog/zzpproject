import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { reviewHtml, reviewOnderwerp, REVIEW_LOGO_URL } from "../../supabase/functions/_shared/reviewMail.ts";
import { testNaarToegestaan, valideerBody, maskeer } from "../../supabase/functions/review-bestaande-klanten/regels.ts";

const html = (soort: any, voornaam: string | null = "Anna") => reviewHtml({ soort, voornaam, klikUrl: "https://x/review-klik?t=abc", afmeldUrl: "https://zpzaken.nl/afmelden?token=t" });

describe("reviewverzoek bestaande klanten: tekst", () => {
  it("onderwerp met en zonder voornaam", () => {
    expect(reviewOnderwerp("review_verzoek_bestaand", "Anna")).toBe("Anna, mag ik je iets vragen?");
    expect(reviewOnderwerp("review_verzoek_bestaand", null)).toBe("Mag ik je iets vragen?");
  });
  it("body exact zoals goedgekeurd", () => {
    const h = html("review_verzoek_bestaand");
    for (const t of [
      "Hoi Anna,",
      "Ik ben Ellen van ZP Zaken. Je hebt dit jaar je BAV en AVB bij ons geregeld, fijn dat je voor ons gekozen hebt.",
      "Mag ik je om een kleine gunst vragen? Een korte review op Google helpt andere zzp'ers die op zoek zijn naar een goede BAV. Twee zinnen is genoeg, het kost je een minuut.",
      ">Schrijf je review op Google</a>",
      "Kan er iets beter? Antwoord dan op deze mail, dan pak ik het persoonlijk op.",
      "Groet,<br>Ellen Baars<br>ZP Zaken | 020 457 3077",
      "https://x/review-klik?t=abc",
      ">Afmelden</a>",
    ]) expect(h).toContain(t);
  });
});

describe("logo in alle reviewmails", () => {
  for (const soort of ["review_verzoek", "review_herinnering", "review_verzoek_bestaand"]) {
    it(soort, () => {
      const h = html(soort);
      expect(h).toContain(`<img src="${REVIEW_LOGO_URL}" alt="ZP Zaken" height="40" style="display:block;border:0;height:40px;width:auto">`);
      expect(h).toMatch(/height="24"/);
      expect(h).not.toMatch(/font-size:20px;font-weight:bold;color:#E53E2F">ZP Zaken/);
      expect(h.toLowerCase()).not.toMatch(/google[^"]*logo/);
    });
  }
  it("logo onder de groetregel", () => {
    const h = html("review_verzoek");
    expect(h.indexOf("ZP Zaken | 020 457 3077")).toBeLessThan(h.lastIndexOf('height="24"'));
  });
});

describe("test_naar en invoer", () => {
  it("alleen @zpzaken.nl", () => {
    expect(testNaarToegestaan("boy.kruiswijk@zpzaken.nl")).toBe(true);
    expect(testNaarToegestaan("iemand@gmail.com")).toBe(false);
    expect(testNaarToegestaan("x@zpzaken.nl.evil.com")).toBe(false);
    expect(valideerBody({ dry_run: false, ronde: 1, test_naar: "a@onefellow.nl" })).toEqual({ error: "test_naar alleen voor @zpzaken.nl" });
  });
  it("ronde 1 of 2 en dry_run verplicht", () => {
    expect(valideerBody({ dry_run: true, ronde: 3 })).toHaveProperty("error");
    expect(valideerBody({ ronde: 1 })).toHaveProperty("error");
    expect(valideerBody({ dry_run: true, ronde: 2 })).toEqual({ dryRun: true, ronde: 2, testNaar: null });
    expect(maskeer("anna@voorbeeld.nl")).toBe("a***@voorbeeld.nl");
  });
});

describe("doelgroep en dubbelbescherming", () => {
  const sql = readFileSync("drizzle/migrations/0226_review_bestaande_klanten.sql", "utf8");
  it("selectie: 100, per e-mail meest recente begin, twee rondes van 50", () => {
    expect(sql).toMatch(/DISTINCT ON \(email\)/);
    expect(sql).toMatch(/LIMIT 100/);
    expect(sql).toMatch(/CASE WHEN rn <= 50 THEN 1 ELSE 2 END/);
    expect(sql).toMatch(/begin_datum < '2026-10-12'/);
    expect(sql).toMatch(/NOT LIKE '%@zpzaken\.nl'/);
    expect(sql).toMatch(/NOT LIKE '%@onefellow\.nl'/);
    expect(sql).toMatch(/incasso_mislukt/);
    expect(sql).toMatch(/review_afmeldingen/);
  });
  it("niemand dubbel: uniek op doelgroep en e-mail; herinnering pakt bestaande klanten op", () => {
    expect(sql).toMatch(/email text NOT NULL UNIQUE/);
    expect(sql).toMatch(/doelgroep_id uuid UNIQUE/);
    expect(sql).toMatch(/review_verzoeken_bestaand_email_uniek ON public\.review_verzoeken \(lower\(trim\(email\)\)\) WHERE doelgroep_id IS NOT NULL/);
    expect(sql).toMatch(/LEFT JOIN public\.review_bestaand_doelgroep d ON d\.id = r\.doelgroep_id/);
  });
  it("functie schrijft eerst de rij, dan pas mail; weekend en schakelaar", () => {
    const src = readFileSync("supabase/functions/review-bestaande-klanten/index.ts", "utf8");
    expect(src.indexOf('.insert({ doelgroep_id: r.id')).toBeLessThan(src.lastIndexOf("await verstuur(r.email"));
    expect(src).toMatch(/reviewverzoeken_actief/);
    expect(src).toMatch(/dag === "Sat" \|\| dag === "Sun"/);
    expect(src).toMatch(/reply_to: "info@zpzaken\.nl"/);
  });
});
