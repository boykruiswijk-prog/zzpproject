// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CYBER_GEBIED_PUBLIEK } from "../config/cyberPubliek";
import { CYBER_DEKKINGSGEBIED } from "../../supabase/functions/_shared/cyberCertificaatTeksten";
function files(dir: string): string[] {
  return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory() ? /^(test|__tests__|integrations)$/.test(e.name) ? [] : files(join(dir,e.name)) : /\.(tsx?|txt|json)$/.test(e.name) && !/\.(test|spec)\./.test(e.name) ? [join(dir,e.name)] : []);
}
describe("E7 cybergebied", () => {
  it("gebied is Europa in publieke bron en certificaat", () => {
    expect(CYBER_GEBIED_PUBLIEK).toBe("Cyberdekkingsgebied: Europa.");
    expect(CYBER_DEKKINGSGEBIED).toBe("Europa");
  });
  it("verbiedt wereldgebied bij cyber, inclusief mails en certificaten", () => {
    const errors: string[]=[];
    for (const file of [...files("src"),...files("supabase/functions"),"scripts/llmsTxt.ts","public/llms.txt","public/llms-full.txt"]) {
      const text=readFileSync(file,"utf8");
      for (const line of text.split(/\n/)) if (/cyber/i.test(line) && /wereldwijd|wereld.{0,45}(?:VS|Canada)|VS en Canada/i.test(line)) errors.push(file+": "+line.trim());
    }
    expect(errors).toEqual([]);
  });
});