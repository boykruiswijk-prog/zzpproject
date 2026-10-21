import { Parser } from "htmlparser2";
import { z } from "zod";

export function publiekeTekst(value: string): string {
  let text = "";
  let hidden = 0;
  const invisible = new Set(["script", "style", "iframe", "object", "template"]);
  const parser = new Parser({
    onopentag(name) { if (invisible.has(name)) hidden++; },
    ontext(value) { if (!hidden) text += value; },
    onclosetag(name) { if (invisible.has(name)) hidden = Math.max(0, hidden - 1); },
  }, { decodeEntities: true });
  parser.write(value); parser.end();
  return text.replace(/[<>]/g, "").trim();
}

export const publiekeRij = z.record(z.unknown()).refine(row => JSON.stringify(row).length <= 128 * 1024);

export function schoonPubliekFormulier(value: unknown): unknown {
  if (typeof value === "string") return publiekeTekst(value);
  if (Array.isArray(value)) return value.map(schoonPubliekFormulier);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, v]) =>
    [key, ["attributie", "sepa_bewijs", "getoonde_documenten", "client_akkoord_op", "toestemming_op"].includes(key) ? v : schoonPubliekFormulier(v)]));
  return value;
}