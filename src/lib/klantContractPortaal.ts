// Mijn ZP voor bestaande klanten zonder online aanvraag: hun lopende contract staat op de klantkaart,
// niet als polisrecord. Labels voor weergave; de data komt uit RPC mijn_klant_contracten.
export type KlantContractPortaal = {
  product: string;
  status: string;
  begin_datum: string | null;
  certificaatnummer: string | null;
  onderneming_naam: string | null;
};

export function contractLabel(product: string): string {
  const p = product.toLowerCase();
  if (p.startsWith("cyber")) return "Cyberverzekering";
  if (p.startsWith("bav")) return "BAV & AVB";
  return product;
}

export function contractRegel(c: KlantContractPortaal): string {
  if (c.certificaatnummer) return `Certificaat ${c.certificaatnummer}`;
  if (c.begin_datum) {
    const [j, m, d] = c.begin_datum.split("-");
    return `Actief sinds ${d}-${m}-${j}`;
  }
  return "Actief";
}

// Eén persoon met meerdere ondernemingen (bijv. eerst eenmanszaak, nu BV): Mijn ZP groepeert per onderneming.
export type MijnOnderneming = { onderneming_id: string; naam: string; kvk: string | null; historie: boolean; policy_ids: string[] };
export type KlantContractPerOnderneming = KlantContractPortaal & { onderneming_id: string; eind_datum: string | null };
export type OndernemingGroep<P> = { onderneming: MijnOnderneming | null; polissen: P[]; contracten: KlantContractPerOnderneming[] };

const LOPEND = new Set(["actief", "loopt_af", "einddatum_controle"]);
export const contractLoopt = (status: string) => LOPEND.has(status);

/** Groepen per onderneming: lopende eerst, historie daarna; polissen zonder bekende onderneming in een groep zonder kop. */
export function groepeerPerOnderneming<P extends { id: string }>(onds: MijnOnderneming[], polissen: P[], contracten: KlantContractPerOnderneming[]): OndernemingGroep<P>[] {
  const gebruikt = new Set<string>();
  const groepen: OndernemingGroep<P>[] = [...onds].sort((a, b) => Number(a.historie) - Number(b.historie) || a.naam.localeCompare(b.naam, "nl")).map((o) => {
    const ps = polissen.filter((p) => o.policy_ids.includes(p.id));
    ps.forEach((p) => gebruikt.add(p.id));
    return { onderneming: o, polissen: ps, contracten: contracten.filter((c) => c.onderneming_id === o.onderneming_id) };
  });
  const rest = polissen.filter((p) => !gebruikt.has(p.id));
  if (rest.length) groepen.unshift({ onderneming: null, polissen: rest, contracten: [] });
  return groepen.filter((g) => g.polissen.length || g.contracten.length);
}

export function contractRegelMetHistorie(c: KlantContractPerOnderneming): string {
  if (contractLoopt(c.status)) return contractRegel(c);
  if (c.eind_datum) { const [j, m, d] = c.eind_datum.split("-"); return `Beëindigd per ${d}-${m}-${j}`; }
  return "Beëindigd";
}
