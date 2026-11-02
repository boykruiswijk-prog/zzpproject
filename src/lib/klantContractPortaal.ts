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
