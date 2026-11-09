// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STARTER } from "@/lib/starterTarief";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return ["test", "__tests__", "admin", "crm", "scherm", "integrations", "ui"].includes(entry.name) ? [] : files(path);
    }
    return /\.(tsx?|json)$/.test(path) ? [path] : [];
  });
}

function resolvePrices(text: string): string {
  return text.replace(/\$?\{(?:eur\()?STARTER\.(\w+)\)?\}/g, (original, key: string) => {
    const value = STARTER[key as keyof typeof STARTER];
    return value === undefined ? original : String(value);
  }).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

describe("TEKSTNORM 9-11: startermaandprijs heeft jaarprijs", () => {
  it("controleert publieke strings en prijsblokken, inclusief dynamische bedragen", () => {
    const errors: string[] = [];
    for (const path of [...files("src"), "scripts/llmsTxt.ts", "supabase/functions/_shared/zekerKennis.generated.ts"]) {
      const source = readFileSync(path, "utf8");
      const blocks = [...source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>|"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`([^`]*)`/g)];
      for (const match of blocks) {
        const text = resolvePrices(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "");
        if (/\b45\s*(?:per maand|\/mnd)\b/i.test(text) && !/\b495\s*per jaar\b/i.test(text)) {
          errors.push(`${path}: ${text}`);
        }
      }
    }
    expect(errors).toEqual([]);
  });
});