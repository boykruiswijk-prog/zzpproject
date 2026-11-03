// Bounded work leaves 60 seconds for persistence and internal mail below the observed 203-second run.
export const PLANNER_WERK_MS = 90_000;
export const PLANNER_BATCH_MAX = 20;
// Vervolgruns: alleen na echte voortgang, maximaal 12 per dag en minimaal 15 minuten ertussen.
export const PLANNER_VERVOLG_MAX_PER_DAG = 12;
export const PLANNER_VERVOLG_MIN_INTERVAL_MIN = 15;

export function eerlijkePlannerVolgorde<T extends { periode_start: string }>(rijen: T[], vandaag: string): T[] {
  const oud = rijen.filter((r) => r.periode_start < vandaag).sort((a, b) => a.periode_start.localeCompare(b.periode_start));
  const nu = rijen.filter((r) => r.periode_start === vandaag);
  const uit: T[] = [];
  while (oud.length || nu.length) {
    const a = oud.shift(); const b = nu.shift();
    if (a) uit.push(a);
    if (b) uit.push(b);
  }
  return uit;
}

export interface PlannerRunUitkomst {
  aangemaakt: number;          // nieuwe factuurconcepten
  statussenBijgewerkt: number; // planning-/creditstatussen die echt veranderden
  creditsAangemaakt: number;   // nieuwe creditconcepten
  resterendWerk: boolean;      // vrije kandidaten, credits of uitgestelde statuscontrole
  vervolgRunsVandaag: number;  // al gedraaide vervolgruns vandaag (inclusief deze, als het een vervolgrun is)
}

/** Echte voortgang = iets aangemaakt of een status die werkelijk veranderde. */
export const heeftVoortgang = (u: Pick<PlannerRunUitkomst, "aangemaakt" | "statussenBijgewerkt" | "creditsAangemaakt">) =>
  u.aangemaakt > 0 || u.statussenBijgewerkt > 0 || u.creditsAangemaakt > 0;

/** Plan alleen een vervolgrun als deze run voortgang boekte, er nog werk is en de daggrens niet bereikt is. */
export function moetVervolgPlannen(u: PlannerRunUitkomst): boolean {
  return heeftVoortgang(u) && u.resterendWerk && u.vervolgRunsVandaag < PLANNER_VERVOLG_MAX_PER_DAG;
}

/** Vervolgrun mag starten: onder de daggrens en minstens 15 minuten na de vorige live run. */
export function vervolgMagStarten(vervolgRunsVandaag: number, vorigeRunStartMs: number | null, nuMs = Date.now()): { ok: boolean; reden?: string } {
  if (vervolgRunsVandaag >= PLANNER_VERVOLG_MAX_PER_DAG) return { ok: false, reden: "daggrens vervolgruns bereikt" };
  if (vorigeRunStartMs != null && nuMs - vorigeRunStartMs < (PLANNER_VERVOLG_MIN_INTERVAL_MIN - 1) * 60_000) return { ok: false, reden: "te kort na vorige run" };
  return { ok: true };
}

/** Dagstandmail (Roxy): maximaal één per dag, pas na de laatste run van de dag. */
export function magDagstandMailen(vervolgGepland: boolean, alGemaildVandaag: boolean): boolean {
  return !vervolgGepland && !alGemaildVandaag;
}

/** Begin van de Nederlandse kalenderdag als UTC-ISO-tijd (zomer- en wintertijd). */
export function startNlDagIso(datum: string): string {
  const middag = new Date(`${datum}T12:00:00Z`);
  const off = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", timeZoneName: "longOffset" })
    .formatToParts(middag).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const m = off.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  const min = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 60;
  return new Date(Date.parse(`${datum}T00:00:00Z`) - min * 60_000).toISOString();
}
