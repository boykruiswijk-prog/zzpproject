// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { EIGEN_RISICO_TEKST, POLISBLAD_NOTITIE, CERTIFICAAT_FOOTER_ALINEAS, CERTIFICAAT_AFM_URL } from "../../supabase/functions/_shared/certificaatRegels";

describe("certificaat D-aanvulling 23 oktober", () => {
  it("eigen risico is de letterlijk vastgestelde toelichting", () => {
    expect(EIGEN_RISICO_TEKST).toBe("Eigen risico is niet van toepassing, deze is voor rekening van ZP Zaken");
  });
  it("BAV AVB mantelpolisnotitie is letterlijk vastgelegd", () => {
    expect(POLISBLAD_NOTITIE).toBe("Je neemt deel aan een mantelpolis waarbij het maximaal verzekerde bedrag per jaar wordt gedeeld met alle deelnemers binnen de betreffende mantelpolis.");
  });
  it("vier footer-alinea's zijn letterlijk vastgelegd", () => {
    expect(CERTIFICAAT_FOOTER_ALINEAS).toEqual([
      "De verzekeringsmantels van ZP Zaken zijn uitsluitend toegankelijk voor klanten van ZP Zaken.",
      "ZP Zaken treedt op als bemiddelaar in verzekeringen en heeft met Hiscox een collectieve verzekeringsovereenkomst gesloten. Hiscox is hierbij de verzekeraar en risicodrager.",
      "ZP Zaken B.V. staat als financieel dienstverlener geregistreerd bij de Autoriteit Financiële Markten (AFM) onder vergunningnummer 12050636.",
      "De verstrekte persoonsgegevens worden vertrouwelijk behandeld en verwerkt overeenkomstig de geldende privacywetgeving.",
    ]);
    expect(CERTIFICAAT_AFM_URL).toBe("https://www.afm.nl/nl-nl/sector/registers/vergunningenregisters/financiele-dienstverleners/details?id=4634B62A-266C-E511-B380-005056BE011D");
  });
  it("oude renderteksten zijn verwijderd en cyber houdt zijn eigen risico", () => {
    const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    expect(src).not.toMatch(/BAV \+ AVB: geen|: "geen"|Waar op het polisblad|op geen enkele|wijze op als financiële dienstverlener/);
    expect(src).toContain('if (heeftNieuweCyber) eigenRisicoLines.push("Cyber: EUR 500 (fraude EUR 1.000).");');
    // The shared-limit note occurs in the BAV AVB amounts section, not the cyber section.
    expect(src.indexOf("const noteText = POLISBLAD_NOTITIE")).toBeLessThan(src.indexOf("// Eigen risico"));
  });
  it("generate-certificate start en weigert zonder sessie, zonder externe effecten", async () => {
    const src = readFileSync("supabase/functions/generate-certificate/index.ts", "utf8");
    const file = ts.createSourceFile("index.ts", src, ts.ScriptTarget.Latest, true);
    let body = src;
    for (const node of file.statements.filter(ts.isImportDeclaration).reverse()) {
      body = body.slice(0, node.getFullStart()) + body.slice(node.end);
    }
    const code = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    let handler: ((req: Request) => Promise<Response>) | undefined;
    const effect = vi.fn(() => { throw new Error("Unexpected external effect"); });
    new Function("serve", "metWerk", "createClient", "fetch", "Deno", code)(
      (fn: typeof handler) => { handler = fn; }, (_: unknown, fn: unknown) => fn,
      effect, effect, { env: { get: effect } },
    );
    if (!handler) throw new Error("No handler registered");
    expect((await handler(new Request("http://localhost", { method: "OPTIONS" }))).status).toBe(200);
    const response = await handler(new Request("http://localhost", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(effect).not.toHaveBeenCalled();
  });
});