// Vestigingsplaats op de klantkaart (Ellen controleert bellers): eigen adres, dan KvK-adres, dan adres uit een aanvraag.
type Ond = { plaats?: string | null; kvk_plaats?: string | null };

export function klantPlaats(ond: Ond, leadPlaatsen: (string | null | undefined)[] = []): string {
  const kandidaten = [ond.plaats, ond.kvk_plaats, ...leadPlaatsen];
  const p = kandidaten.map((x) => (x ?? "").trim()).find((x) => x.length > 0);
  return p ?? "plaats onbekend";
}
