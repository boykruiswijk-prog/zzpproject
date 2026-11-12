// Besluit Boy 12-11-2026: vaste teksten en volgorde voor het opgeschoonde Live-scherm.
export type NettoBlok = { nieuw: number; gestopt: number; netto: number };
const nl = new Intl.NumberFormat("nl-NL");
/** "Sinds 1 oktober: +47 nieuw, -17 gestopt = +30 netto". */
export function nettoRegel(titel: string, b: NettoBlok): string {
  const teken = (n: number) => (n > 0 ? `+${nl.format(n)}` : n < 0 ? `-${nl.format(-n)}` : "0");
  return `${titel}: ${teken(b.nieuw)} nieuw, ${teken(-b.gestopt)} gestopt = ${teken(b.netto)} netto`;
}
/** Robots met een fout bovenaan, verder de vaste volgorde. */
export function aiTeamVolgorde<T extends { status: string }>(team: T[]): T[] {
  return [...team.filter((a) => a.status === "fout"), ...team.filter((a) => a.status !== "fout")];
}
