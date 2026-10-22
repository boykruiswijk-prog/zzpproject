import { z } from "npm:zod@3.25.76";
import { Parser } from "npm:htmlparser2@10.0.0";
import { WERKZAAMHEDEN_MAX, WERKZAAMHEDEN_TE_LANG } from "./werkzaamheden.ts";

/** Parse HTML as text, discarding executable/invisible element contents. */
export function gewoneTekst(input: string): string {
  let output = "";
  let hidden = 0;
  const invisible = new Set(["script", "style", "iframe", "object", "template"]);
  const parser = new Parser({
    onopentag(name) { if (invisible.has(name)) hidden++; },
    ontext(text) { if (!hidden) output += text; },
    onclosetag(name) { if (invisible.has(name)) hidden = Math.max(0, hidden - 1); },
  }, { decodeEntities: false });
  parser.write(input);
  parser.end();
  return output.trim();
}

function bounded(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 10000;
  if (Array.isArray(value)) return value.length <= 100 && value.every(v => bounded(v, depth + 1));
  if (typeof value !== "object" || !value) return false;
  const entries = Object.entries(value);
  return entries.length <= 100 && entries.every(([key, v]) =>
    key.length <= 100 && !["__proto__", "constructor", "prototype"].includes(key) && bounded(v, depth + 1));
}

export const objectInvoer = z.record(z.unknown()).superRefine((v, ctx) => {
  if (!bounded(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ongeldige of te grote invoer." });
});

const text = (max: number) => z.string().max(max);
const nullableText = (max: number) => text(max).nullable().optional();
const date = text(10).regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
});

export const bavInvoer = z.object({
  gekozen_pakket: text(50).min(1), betaalwijze: z.enum(["maandelijks", "jaarlijks"]), ingangsdatum: date,
  voornaam: text(100).trim().min(1), achternaam: text(100).trim().min(1),
  email: text(255).trim().regex(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/), bedrijfsnaam: text(200).trim().min(1),
  telefoon: nullableText(30), kvk_nummer: nullableText(30), kvk_startdatum: date.nullable().optional(),
  beroep: z.string().max(WERKZAAMHEDEN_MAX, WERKZAAMHEDEN_TE_LANG).nullable().optional(), sector: nullableText(200), opmerkingen: nullableText(5000),
  adres_straat: nullableText(200), adres_huisnummer: nullableText(30), adres_postcode: nullableText(20),
  adres_plaats: nullableText(200), adres_land: nullableText(100),
  iban: nullableText(50), rekeninghouder: nullableText(200),
  lead_id: z.string().uuid().optional(), concept_id: z.string().uuid().nullable().optional(),
  kvk_uittreksel_id: z.string().uuid().nullable().optional(),
  sepa_akkoord: z.boolean().optional(), cyber_akkoord: z.boolean().optional(),
  cyber_aangevraagd: z.boolean().optional(), vereist_handmatige_beoordeling: z.boolean().optional(),
  hp: text(500).optional(), ms: z.number().finite().nonnegative().optional(),
}).passthrough();

/** Only visitor display text; evidence, consent, bank details and attribution stay untouched. */
export function saneerBavTekst<T extends Record<string, unknown>>(body: T): T {
  const out = { ...body };
  for (const key of ["voornaam", "achternaam", "bedrijfsnaam", "beroep", "sector", "opmerkingen", "formulier_naam"]) {
    if (typeof out[key] === "string") Object.assign(out, { [key]: gewoneTekst(out[key] as string) });
  }
  // The ordered submission is evidence; output renderers escape it without rewriting it.
  return out;
}

export function saneerVrijeTekst(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out = { ...value } as Record<string, unknown>;
  for (const key of ["formulier_naam", "voorkeursmoment", "bericht", "vraag", "opmerkingen"]) {
    if (typeof out[key] === "string") out[key] = gewoneTekst(out[key] as string);
  }
  return out;
}

export function valideerPubliekeRij(value: unknown): boolean {
  const parsed = objectInvoer.safeParse(value);
  if (!parsed.success) return false;
  return Object.entries(parsed.data).every(([k, v]) => {
    if (v === null) return true;
    if (["extra_data"].includes(k)) return objectInvoer.safeParse(v).success;
    if (k === "vereist_handmatige_beoordeling") return typeof v === "boolean";
    if (k === "interesse_gebieden") return Array.isArray(v) && v.every(x => typeof x === "string" && x.length <= 200);
    if (["verzekerd_bedrag", "eigen_risico"].includes(k)) return typeof v === "string" || typeof v === "number";
    return typeof v === "string" && v.length <= (k === "email" ? 255 : 5000);
  });
}

/** Bound actual bytes, not just a caller-controlled Content-Length header. */
export async function leesBegrensdeBody(req: Request, maxBytes = 128 * 1024): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("body_too_large"); }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}