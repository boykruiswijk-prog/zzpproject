import { useEffect, useState } from "react";
import { isNederland, normaliseerPostcode } from "@/lib/adresNormalisatie";

export const PDOK_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

export type PdokAdres = { straat: string; plaats: string; postcode: string; huisnummer: string };

/** Zoekt het officiële adres op bij PDOK. Nooit blokkerend: bij fout/timeout (3 s) → null. */
export async function zoekPdokAdres(postcode: string, huisnummer: string, signal?: AbortSignal): Promise<PdokAdres | null> {
  const pc = normaliseerPostcode(postcode, "NL").replace(" ", "");
  const nr = huisnummer.trim().match(/^\d+/)?.[0];
  if (!/^[1-9]\d{3}[A-Z]{2}$/.test(pc) || !nr) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const q = encodeURIComponent(`postcode:${pc} and huisnummer:${nr}`);
    const res = await fetch(`${PDOK_URL}?q=${q}&fq=type:adres&rows=1`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const doc = (await res.json())?.response?.docs?.[0];
    if (!doc?.straatnaam || !doc?.woonplaatsnaam) return null;
    return { straat: String(doc.straatnaam), plaats: String(doc.woonplaatsnaam), postcode: normaliseerPostcode(pc, "NL"), huisnummer: huisnummer.trim() };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function usePdokAdres(postcode: string, huisnummer: string, land: string | null | undefined) {
  const [adres, setAdres] = useState<PdokAdres | null>(null);
  useEffect(() => {
    setAdres(null);
    if (!isNederland(land) || !postcode.trim() || !huisnummer.trim()) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      zoekPdokAdres(postcode, huisnummer, ctrl.signal).then((r) => { if (!ctrl.signal.aborted) setAdres(r); });
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [postcode, huisnummer, land]);
  return adres;
}
