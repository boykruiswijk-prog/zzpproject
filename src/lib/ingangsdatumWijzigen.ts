// Regels voor "Ingangsdatum wijzigen" (besluit Boy 12-11-2026). Spiegel van de database-RPC
// contract_ingangsdatum_blokkade; de database blijft leidend.
export type ContractVoorIngang = {
  begin_datum: string | null; eind_datum: string | null; gefactureerd_tm: string | null;
  planning_regels?: number; credit_regels?: number;
};

const dag = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
const plusDagen = (iso: string, n: number) => new Date(dag(iso) + n * 86400000).toISOString().slice(0, 10);
const plusJaar = (iso: string) => { const [j, m, d] = iso.slice(0, 10).split("-"); return `${Number(j) + 1}-${m}-${d}`; };
const nl = (iso: string) => { const [j, m, d] = iso.slice(0, 10).split("-"); return `${d}-${m}-${j}`; };

export const MIN_REDEN = 10;

export function ingangsdatumBlokkade(c: ContractVoorIngang, vandaag: string, nieuweDatum?: string | null, reden?: string | null): string | null {
  if (c.eind_datum) return "Dit contract is beëindigd. De ingangsdatum kan niet meer worden gewijzigd.";
  if (!c.begin_datum) return "Dit contract heeft geen ingangsdatum.";
  if ((c.planning_regels ?? 0) > 0) return "Voor dit contract is al een factuur gepland of gemaakt. Wijzig de ingangsdatum via de administratie.";
  if ((c.credit_regels ?? 0) > 0) return "Voor dit contract is al een creditnota gepland. Wijzig de ingangsdatum via de administratie.";
  if (c.gefactureerd_tm && c.gefactureerd_tm >= c.begin_datum) return `Voor dit contract is al gefactureerd (t/m ${nl(c.gefactureerd_tm)}).`;
  if (nieuweDatum) {
    if (nieuweDatum === c.begin_datum.slice(0, 10)) return "De nieuwe ingangsdatum is gelijk aan de huidige.";
    if (nieuweDatum > plusJaar(vandaag)) return "De nieuwe ingangsdatum ligt meer dan 1 jaar in de toekomst.";
    if (nieuweDatum < plusDagen(vandaag, -60)) return "De nieuwe ingangsdatum ligt meer dan 60 dagen in het verleden.";
  }
  if (reden != null && reden.trim().length < MIN_REDEN) return `Geef een reden van minimaal ${MIN_REDEN} tekens.`;
  return null;
}

/** "Gefactureerd t/m" alleen tonen als er echt gefactureerd is. */
export function factuurLabel(c: { begin_datum: string | null; gefactureerd_tm: string | null }, verstuurdeFactuur: boolean): string {
  if (c.begin_datum && (!c.gefactureerd_tm || c.gefactureerd_tm < c.begin_datum) && !verstuurdeFactuur) return `Nog niet gefactureerd (start ${nl(c.begin_datum)})`;
  return c.gefactureerd_tm ? `Gefactureerd t/m ${nl(c.gefactureerd_tm)}` : "Nog niet gefactureerd";
}

export function certificaatMailLabel(gemaildOp: string | null | undefined): string {
  if (!gemaildOp) return "Certificaat nog niet gemaild";
  const d = new Date(gemaildOp);
  const datum = d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
  const tijd = d.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
  return `Certificaat gemaild op ${datum} ${tijd}`;
}

export function samenvatting(oud: string, nieuw: string): string {
  return `Ingangsdatum ${nl(oud)} -> ${nl(nieuw)}. Facturatie start op ${nl(nieuw)}; gefactureerd t/m wordt ${nl(plusDagen(nieuw, -1))}.`;
}
