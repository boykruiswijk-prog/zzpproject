// A8-aanvulling Dagomzet: nieuwe jaarpremie uit de aanvragen van vandaag (Europe/Amsterdam).
// Pure TypeScript; alleen een totaal en een aantal verlaten de server, nooit regels per klant.
import { aanvraagPremie } from "./cyber.ts";

export const DAGOMZET_PAKKETTEN = ["maandelijks", "jaarlijks", "jaarlijks-cyber", "maandelijks-cyber"] as const;

/** Jaarpremie zoals de conversiewaarde: maandpakket x 12, jaarpakket = jaarprijs; starter- en cyberprijs inbegrepen. */
export function aanvraagJaarpremie(pakket: unknown, tariefType: unknown): number {
  const p = String(pakket ?? "");
  if (!(DAGOMZET_PAKKETTEN as readonly string[]).includes(p)) return 0;
  const { totaal, maand } = aanvraagPremie(p, tariefType === "starter");
  return Math.round((maand ? totaal * 12 : totaal) * 100) / 100;
}

/** Datum (YYYY-MM-DD) in Europe/Amsterdam. */
export function amsterdamDag(nu = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(nu);
}

export type Dagomzet = { dag: string; bedrag: number; aantal: number };

export function berekenDagomzet(rijen: unknown, nu = new Date()): Dagomzet {
  const lijst = Array.isArray(rijen) ? rijen : [];
  const bedrag = lijst.reduce((s, r) => s + aanvraagJaarpremie(r?.pakket, r?.tarief_type), 0);
  return { dag: amsterdamDag(nu), bedrag: Math.round(bedrag), aantal: lijst.length };
}

/** Wat het scherm toont: na middernacht (Amsterdam) terug naar 0 tot er nieuwe data is. */
export function dagomzetWeergave(d: Partial<Dagomzet> | null | undefined, nu = new Date()): { bedrag: number; aantal: number } {
  if (!d || d.dag !== amsterdamDag(nu)) return { bedrag: 0, aantal: 0 };
  const getal = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : 0);
  return { bedrag: getal(d.bedrag), aantal: getal(d.aantal) };
}
