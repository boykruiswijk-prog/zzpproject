// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { zoekLegacyDoel } from "@/config/legacyRedirects";
import { seoRoutes } from "@/config/seoRoutes";

const oudeZinnen = [
  "zonder financieel risico",
  "jouw polis dekt de geleden schade",
  "wordt gedekt door jouw BAV-polis",
  "dekt dat.",
  "in de juiste verhouding",
  "aan de juiste verzekering",
  "welke dekking bij jouw werk past",
  "welke dekking daarbij hoort",
  "Beschermd tegen aansprakelijkheid bij medische fouten",
];

function bronnen(map: string): string[] {
  return readdirSync(map, { withFileTypes: true }).flatMap((item) => {
    const pad = resolve(map, item.name);
    if (item.isDirectory()) return bronnen(pad);
    return /\.(tsx?|json|txt)$/.test(item.name) && !/\.(test|spec)\./.test(item.name) ? [pad] : [];
  });
}

describe("Kwaliteitscontrole 25 oktober", () => {
  for (const zin of oudeZinnen) {
    it(`oude formulering ontbreekt: ${zin}`, () => {
      const bestanden = [
        ...bronnen(resolve("src")),
        ...bronnen(resolve("scripts")),
        resolve("public/llms.txt"),
        resolve("public/llms-full.txt"),
        resolve("supabase/functions/_shared/zekerKennis.generated.ts"),
      ];
      for (const pad of bestanden) {
        expect(readFileSync(pad, "utf8").includes(zin), pad).toBe(false);
      }
    });
  }

  it("meta descriptions met 'vanaf € 55 per maand' noemen ook € 600 en assurantiebelasting", () => {
    for (const route of seoRoutes) {
      if (route.description.includes("vanaf € 55 per maand") || route.description.includes("Vanaf € 55 per maand")) {
        expect(route.description, route.path).toContain("€ 600");
        expect(route.description, route.path).toContain("assurantiebelasting");
      }
    }
  });

  it("pad met gecodeerd vraagteken (/%3F...) gaat naar / met gedecodeerde query, ook met taalprefix", () => {
    expect(zoekLegacyDoel("/%3Futm_source=organic%26utm_medium=google%26utm_campaign=gmb-listing")).toBe(
      "/?utm_source=organic&utm_medium=google&utm_campaign=gmb-listing",
    );
    expect(zoekLegacyDoel("/%3futm_source=organic")).toBe("/?utm_source=organic");
    expect(zoekLegacyDoel("/en/%3Futm_source=organic")).toBe("/?utm_source=organic");
    expect(zoekLegacyDoel("/tv")).toBeNull();
  });
});
