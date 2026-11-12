// Reacties op notities (besluit Boy 12-11-2026). Een reactie is een notitie met parent_id, één niveau diep.
export type DraadNotitie = { id: string; parent_id?: string | null; datum: string; auteur_id?: string | null };
export type Draad<T extends DraadNotitie> = { hoofd: T; reacties: T[]; laatsteActiviteit: string };

export const INGEKLAPT_VANAF = 3; // meer dan 2 reacties: ingeklapt
export const NIEUW_LABEL_UREN = 24;

/** Wortel van een notitie: reactie op reactie hangt aan dezelfde hoofdnotitie. */
export function wortelId(id: string, perId: Map<string, DraadNotitie>): string {
  const n = perId.get(id);
  if (!n?.parent_id) return id;
  const ouder = perId.get(n.parent_id);
  return ouder?.parent_id ?? n.parent_id;
}

/** Groepeert notities in draden en sorteert op laatste activiteit (nieuwste eerst). */
export function bouwDraden<T extends DraadNotitie>(notities: T[]): Draad<T>[] {
  const perId = new Map(notities.map((n) => [n.id, n as DraadNotitie]));
  const draden = new Map<string, Draad<T>>();
  for (const n of notities) if (!n.parent_id || !perId.has(n.parent_id)) draden.set(n.id, { hoofd: n, reacties: [], laatsteActiviteit: n.datum });
  for (const n of notities) {
    if (!n.parent_id || !perId.has(n.parent_id)) continue;
    const d = draden.get(wortelId(n.id, perId));
    if (!d) continue;
    d.reacties.push(n);
    if (n.datum > d.laatsteActiviteit) d.laatsteActiviteit = n.datum;
  }
  for (const d of draden.values()) d.reacties.sort((a, b) => (a.datum < b.datum ? -1 : 1));
  return Array.from(draden.values()).sort((a, b) => (a.laatsteActiviteit < b.laatsteActiviteit ? 1 : -1));
}

/** Label "nieuwe reactie": laatste reactie van een ander teamlid, minder dan 24 uur oud. */
export function heeftNieuweReactie(d: Draad<DraadNotitie>, ikId: string | null | undefined, nu: Date = new Date()): boolean {
  const laatste = d.reacties[d.reacties.length - 1];
  if (!laatste) return false;
  if (laatste.auteur_id && laatste.auteur_id === ikId) return false;
  return nu.getTime() - new Date(laatste.datum).getTime() < NIEUW_LABEL_UREN * 3600_000;
}

export function zichtbareReacties<T>(reacties: T[], uitgeklapt: boolean): T[] {
  return reacties.length >= INGEKLAPT_VANAF && !uitgeklapt ? [] : reacties;
}

/** Automatisch gemaakte notitie (activatie, mails, koppelingen, Mijn ZP, besluituitvoering). */
export function isSysteemNaam(naam: string | null | undefined): boolean {
  if (!naam) return true;
  return /systeem|automatisch|via mijn zp/i.test(naam);
}

export type NotitieFilter = "alles" | "handgeschreven";
export function filterDraden<T extends DraadNotitie & { systeem: boolean }>(draden: Draad<T>[], f: NotitieFilter): Draad<T>[] {
  return f === "alles" ? draden : draden.filter((d) => !d.hoofd.systeem);
}
