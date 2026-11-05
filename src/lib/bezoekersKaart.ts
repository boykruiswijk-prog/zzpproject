import { NL_KAART_PROJECTIE as P } from "@/data/nlKaart";
import { NL_PLAATSEN } from "@/data/nlPlaatsen";
import { BUITENLAND, ONBEKEND, type BezoekPlaats } from "../../supabase/functions/_shared/bezoekers";

/** Kantoor ZP Zaken, Schiphol-Rijk. */
export const SCHIPHOL_RIJK = { lat: 52.2796, lon: 4.7514 } as const;

/** Ongeveer het midden van elke provincie (terugval bij een onbekende plaatsnaam). */
export const PROVINCIE_MIDDEN: Record<string, [number, number]> = {
  "Groningen": [53.22, 6.74], "Fryslân": [53.1, 5.85], "Drenthe": [52.86, 6.62], "Overijssel": [52.44, 6.45],
  "Flevoland": [52.53, 5.6], "Gelderland": [52.06, 5.95], "Utrecht": [52.08, 5.18], "Noord-Holland": [52.58, 4.87],
  "Zuid-Holland": [51.99, 4.5], "Zeeland": [51.5, 3.85], "Noord-Brabant": [51.56, 5.2], "Limburg": [51.2, 5.93],
};

// Enkele GA4-schrijfwijzen die in de lijst anders heten.
const ALIAS: Record<string, string> = { "den haag": "the hague", "'s-gravenhage": "the hague", "den bosch": "'s-hertogenbosch", "hertogenbosch": "'s-hertogenbosch" };

export function projecteer(lat: number, lon: number) {
  return { x: Math.round((lon - P.lon0) * P.cos * P.k * 10) / 10, y: Math.round((P.lat0 - lat) * P.k * 10) / 10 };
}

/** Coördinaat voor een plaats; onbekende plaats valt terug op het midden van de provincie, anders null. */
export function coordinaatVoor(plaats: string, provincie: string): { lat: number; lon: number; bron: "plaats" | "provincie" } | null {
  if (!plaats || plaats === ONBEKEND || plaats === BUITENLAND) return null;
  const k = plaats.trim().toLowerCase();
  const hit = NL_PLAATSEN[k] ?? NL_PLAATSEN[ALIAS[k] ?? ""];
  if (hit) return { lat: hit[0], lon: hit[1], bron: "plaats" };
  const m = PROVINCIE_MIDDEN[provincie];
  return m ? { lat: m[0], lon: m[1], bron: "provincie" } : null;
}

export type KaartPunt = BezoekPlaats & { x: number; y: number; r: number };

/** Stippen voor de kaart: '(not set)'/onbekend en buitenland komen er nooit op. Straal naar aantal (wortel). */
export function kaartPunten(plaatsen: BezoekPlaats[], max = 60): KaartPunt[] {
  const hoogste = Math.max(1, ...plaatsen.map((p) => p.aantal));
  const uit: KaartPunt[] = [];
  for (const p of plaatsen) {
    const c = coordinaatVoor(p.plaats, p.provincie);
    if (!c) continue;
    const { x, y } = projecteer(c.lat, c.lon);
    uit.push({ ...p, x, y, r: 5 + 17 * Math.sqrt(p.aantal / hoogste) });
    if (uit.length >= max) break;
  }
  return uit;
}

/** Gebogen pad van een plaats naar Schiphol-Rijk. */
export function boogPad(van: { x: number; y: number }) {
  const n = projecteer(SCHIPHOL_RIJK.lat, SCHIPHOL_RIJK.lon);
  const mx = (van.x + n.x) / 2, my = (van.y + n.y) / 2;
  const d = Math.hypot(n.x - van.x, n.y - van.y);
  return `M${van.x} ${van.y}Q${mx} ${Math.round((my - d * 0.35) * 10) / 10} ${n.x} ${n.y}`;
}

/** Plaatsen waar het aantal sinds de vorige verversing is gestegen: daar vuurt de boog opnieuw. */
export function nieuweBezoekers(vorig: Map<string, number>, nu: BezoekPlaats[]) {
  return nu.filter((p) => p.aantal > (vorig.get(p.plaats) ?? 0)).map((p) => p.plaats);
}
