// Pure helpers voor de Exact-statuskaart op /admin/integraties.
export const KEEPALIVE_MAX_UUR = 26;
export const REFRESH_TOKEN_DAGEN = 30;

export type ExactHealth =
  | { kind: "niet_actief"; label: string }
  | { kind: "fout"; label: string; melding: string }
  | { kind: "verouderd"; label: string }
  | { kind: "ok"; label: string };

export function bepaalExactHealth(input: {
  isActief: boolean;
  lastError: string | null | undefined;
  laatsteKeepaliveSucces: string | null | undefined;
  now?: Date;
}): ExactHealth {
  if (!input.isActief) return { kind: "niet_actief", label: "Niet actief" };
  const fout = (input.lastError ?? "").trim();
  if (fout) return { kind: "fout", label: "Koppeling werkt niet", melding: fout };
  const now = (input.now ?? new Date()).getTime();
  const t = input.laatsteKeepaliveSucces ? new Date(input.laatsteKeepaliveSucces).getTime() : NaN;
  if (!Number.isFinite(t) || now - t >= KEEPALIVE_MAX_UUR * 3600_000) {
    return { kind: "verouderd", label: "Controle ouder dan 26 uur" };
  }
  return { kind: "ok", label: "Koppeling werkt" };
}

export function herkoppelenVoor(refreshObtainedAt: string | null | undefined): Date | null {
  if (!refreshObtainedAt) return null;
  const t = new Date(refreshObtainedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + REFRESH_TOKEN_DAGEN * 86400_000);
}

/** Offset (ms) van Europe/Amsterdam t.o.v. UTC op een gegeven moment. */
function amsterdamOffset(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** UTC-grenzen [start, eind) van de Amsterdamse kalenderdag waarin `now` valt. */
export function amsterdamDagGrenzen(now: Date = new Date()): { start: string; eind: string } {
  const local = new Date(now.getTime() + amsterdamOffset(now));
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  const toUtc = (yy: number, mm: number, dd: number) => {
    const guess = new Date(Date.UTC(yy, mm, dd));
    return new Date(guess.getTime() - amsterdamOffset(new Date(guess.getTime() - amsterdamOffset(guess))));
  };
  return { start: toUtc(y, m, d).toISOString(), eind: toUtc(y, m, d + 1).toISOString() };
}
