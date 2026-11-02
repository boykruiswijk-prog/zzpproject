// Bounded work leaves 60 seconds for persistence and internal mail below the observed 203-second run.
export const PLANNER_WERK_MS = 90_000;
export const PLANNER_BATCH_MAX = 20;
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