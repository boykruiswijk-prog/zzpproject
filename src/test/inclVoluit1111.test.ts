// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Publieke bronnen: geen tests, admin of crm. Commentaar telt niet als publieke tekst. */
function bronnen(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const pad = join(dir, e.name);
    if (e.isDirectory()) return ["test", "__tests__", "admin", "crm"].includes(e.name) ? [] : bronnen(pad);
    return /\.(?:[jt]sx?|json|md|txt|html)$/.test(pad) && !/\.(?:test|spec)\./.test(pad) ? [pad] : [];
  });
}
const zonderCommentaar = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const bestanden = [...bronnen("src"), ...bronnen("i18n"), "index.html", "public/llms.txt", "public/llms-full.txt",
  "supabase/functions/_shared/zekerKennis.generated.ts"].filter(existsSync);

function treffers(re: RegExp) {
  return bestanden.flatMap(pad => {
    const t = zonderCommentaar(readFileSync(pad, "utf8"));
    const m = re.exec(t);
    return m ? [`${pad}:${t.slice(0, m.index).split("\n").length}: ${m[0]}`] : [];
  });
}

describe("Kwaliteitscontrole 11 november: voluit en online cybervoorwaarden", () => {
  it("regex vangt de afkorting en laat inclusief door", () => {
    expect(/\bincl\./i.test("€55, Incl. kosten")).toBe(true);
    expect(/\bincl\./i.test("inclusief kosten")).toBe(false);
  });
  it("geen 'incl.' in publieke tekst", () => {
    expect(treffers(/\bincl\./i)).toEqual([]);
  });
  it("cybervoorwaarden worden nergens publiek opgevraagd", () => {
    expect(treffers(/(cybervoorwaarden|voorwaarden (?:van|voor) (?:de )?cyber)[^.]{0,120}(opvra|vraag je op|op te vragen)/i)).toEqual([]);
  });
  it("vergelijkingspagina verwijst naar /voorwaarden#cyber", () => {
    expect(readFileSync("src/config/cyberPubliek.ts", "utf8")).toContain("voorwaarden#cyber");
    expect(readFileSync("src/pages/BavZzpVergelijken.tsx", "utf8")).toContain("CYBER_VOORWAARDEN_OPVRAGEN");
  });
});
