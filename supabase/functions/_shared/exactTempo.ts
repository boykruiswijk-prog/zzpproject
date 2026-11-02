// Vast tempo en herhaalpogingen voor Exact-aanroepen (C-aanvulling Factuurplanner 429).
// - Minimaal 1,1 seconde tussen twee Exact-aanroepen (zelfde tempo als de preflight).
// - Bij HTTP 429 of 503: Retry-After respecteren, anders oplopend wachten; maximaal 3 pogingen.
// - POST wordt hier nooit automatisch herhaald: dat beslist postMetSleutel na een sleutelcontrole.

export const EXACT_MIN_INTERVAL_MS = 1100;
export const EXACT_MAX_POGINGEN = 3;
const MAX_WACHT_MS = 60_000;

export class ExactTijdelijkError extends Error {
  constructor(public httpStatus: number, wat: string) { super(`${wat} HTTP ${httpStatus} (tijdelijk, Exact weigerde)`); }
}

export const isTijdelijkeStatus = (s: number) => s === 429 || s === 503;

export function wachtTijdUit(retryAfter: string | null, poging: number, nu = Date.now()): number {
  if (retryAfter) {
    const sec = Number(retryAfter.trim());
    if (Number.isFinite(sec) && sec >= 0) return Math.min(sec * 1000, MAX_WACHT_MS);
    const t = Date.parse(retryAfter);
    if (Number.isFinite(t)) return Math.min(Math.max(t - nu, 0), MAX_WACHT_MS);
  }
  return Math.min(2000 * 2 ** (poging - 1), MAX_WACHT_MS); // 2s, 4s, 8s
}

export interface TempoOpties { slaap?: (ms: number) => Promise<void>; nu?: () => number; minInterval?: number; maxPogingen?: number; deadline?: number }

/** Geeft een functie die elke Exact-aanroep in vast tempo uitvoert en GET's bij 429/503 herhaalt. */
export function maakExactTempo(opties: TempoOpties = {}) {
  const nu = opties.nu ?? (() => Date.now());
  const slaapBasis = opties.slaap ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const slaap = async (ms: number) => {
    if (opties.deadline != null && nu() + ms + 10_000 >= opties.deadline) throw new ExactTijdelijkError(429, "tijdsbudget");
    await slaapBasis(ms);
  };
  const min = opties.minInterval ?? EXACT_MIN_INTERVAL_MS;
  const max = opties.maxPogingen ?? EXACT_MAX_POGINGEN;
  let laatste = -Infinity;
  const opTempo = async () => {
    if (opties.deadline != null && nu() + 10_000 >= opties.deadline) throw new ExactTijdelijkError(429, "tijdsbudget");
    const w = laatste + min - nu();
    if (w > 0) await slaap(w);
    laatste = nu();
  };
  return async (doe: () => Promise<Response>, herhaal = true): Promise<Response> => {
    let r: Response | null = null;
    for (let poging = 1; poging <= (herhaal ? max : 1); poging++) {
      await opTempo();
      r = await doe();
      if (!isTijdelijkeStatus(r.status) || poging === (herhaal ? max : 1)) return r;
      await slaap(wachtTijdUit(r.headers.get("retry-after"), poging));
    }
    if (!r) throw new Error("Exact gaf geen antwoord");
    return r;
  };
}

export type PostUitkomst =
  | { soort: "aangemaakt"; r: Response }
  | { soort: "bestond"; rij: any }
  | { soort: "tijdelijk"; httpStatus: number }
  | { soort: "antwoord"; r: Response };

/**
 * POST een concept met sleutel. Bij 429 eerst (getempeerd) de sleutel controleren; pas als
 * die zeker niet bestaat, opnieuw POST'en. Nooit een tweede POST als de sleutel al bestaat.
 * Een 503 op een POST is onzeker en wordt als "antwoord" teruggegeven (planner stopt dan).
 */
export async function postMetSleutel(post: () => Promise<Response>, zoek: () => Promise<any[]>, slaap: (ms: number) => Promise<void>, max = EXACT_MAX_POGINGEN): Promise<PostUitkomst> {
  for (let poging = 1; poging <= max; poging++) {
    const r = await post();
    if (r.ok) return { soort: "aangemaakt", r };
    if (r.status !== 429) return { soort: "antwoord", r };
    await slaap(wachtTijdUit(r.headers.get("retry-after"), poging));
    const rij = (await zoek())[0]; // gooit ExactTijdelijkError als ook de controle blijft weigeren
    if (rij) return { soort: "bestond", rij };
  }
  return { soort: "tijdelijk", httpStatus: 429 };
}
