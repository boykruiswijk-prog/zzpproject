/**
 * Lijst van alle oplosbare fiscale tokens (sleutel|variant), afgeleid van
 * src/lib/fiscaleTokens.ts. De publicatiecontrole in de database
 * (artikel_fiscaal_token_check) gebruikt exact deze lijst; parity-test:
 * src/test/fiscaleTokensPublicatie.test.ts.
 */
import { fiscaleCijfers, fiscaleCijferSleutels } from "../src/data/fiscaleCijfers";
import { resolveFiscaalToken } from "../src/lib/fiscaleTokens";

const AFGELEID = [
  "nulgrensWinst", "nulgrensOndernemersaftrek", "nulgrensWinstNaOndernemersaftrek",
  "nulgrensMkbVrijstelling", "nulgrensBelastbaarInkomen", "nulgrensBelastingSchijf1",
  "nulgrensAlgemeneHeffingskorting", "nulgrensArbeidskorting", "nulgrensTeBetalen",
];

export function oplosbareFiscaleTokens(): { vast: string[]; afgeleid: string[] } {
  const vast: string[] = [];
  for (const s of fiscaleCijferSleutels) {
    const c = fiscaleCijfers[s] as { belastingjaar: number; historie?: Record<number, number>; aangekondigd?: Record<number, number> };
    const jaren = new Set<number>([c.belastingjaar, ...Object.keys(c.historie ?? {}).map(Number), ...Object.keys(c.aangekondigd ?? {}).map(Number)]);
    const varianten = ["", "waarde", "euro", "jaar", "label", "volledig", "bron"];
    for (const j of jaren) varianten.push(String(j), `${j}_euro`);
    for (const v of varianten) if (resolveFiscaalToken(s, v || undefined) !== null) vast.push(`${s}|${v}`);
  }
  return { vast: vast.sort(), afgeleid: AFGELEID.filter((s) => resolveFiscaalToken(s) !== null).sort() };
}

export function fiscaleTokenSqlArray(): string {
  const { vast } = oplosbareFiscaleTokens();
  return `ARRAY[${vast.map((t) => `'${t}'`).join(",")}]::text[]`;
}

if ((import.meta as { main?: boolean }).main) {
  const { afgeleid } = oplosbareFiscaleTokens();
  console.log(fiscaleTokenSqlArray());
  console.log(`ARRAY[${afgeleid.map((t) => `'${t}'`).join(",")}]::text[]`);
}

/** Compacte vorm per sleutel: "sleutel:E|-:jaar,jaar" (E = euro-bedrag). */
export function fiscaleTokenCompact(): string[] {
  return [...fiscaleCijferSleutels].sort().map((s) => {
    const c = fiscaleCijfers[s] as { eenheid: string; belastingjaar: number; historie?: Record<number, number>; aangekondigd?: Record<number, number> };
    const jaren = [...new Set([c.belastingjaar, ...Object.keys(c.historie ?? {}).map(Number), ...Object.keys(c.aangekondigd ?? {}).map(Number)])].sort();
    return `${s}:${c.eenheid === "euro" ? "E" : "-"}:${jaren.join(",")}`;
  });
}
