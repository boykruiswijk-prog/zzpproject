// Uitleg en doorklik per rode teller in het beheermenu. Pure functies, gedeeld door menu en dashboardlegenda.
export type TellerSleutel = "aanvragen" | "leads" | "service" | "opzeggingen" | "screening" | "afgehaakt" | "chat" | "klanten" | "facturatie" | "bav_nakijken" | "credits_akkoord" | "machtigingen";
export type Tellers = Partial<Record<string, number>>;

/** Tellers die niet meetellen in een groepstotaal (geen directe actie, grijze badge). */
export const GRIJZE_TELLERS = new Set<TellerSleutel>(["bav_nakijken", "machtigingen"]);

export const TELLER_DOEL: Record<TellerSleutel, string> = {
  aanvragen: "/admin/aanvragen", leads: "/admin/leads", afgehaakt: "/admin/afgehaakt",
  opzeggingen: "/admin/opzeggingen", credits_akkoord: "/admin/creditnotas-goedkeuren",
  service: "/admin/service-aanvragen", screening: "/admin/screening-aanvragen",
  bav_nakijken: "/admin/bav-nummer-nakijken", facturatie: "/admin/facturatieplanning",
  chat: "/admin/chatgesprekken", klanten: "/admin/klanten#creditnotas", machtigingen: "/admin/machtigingen-nakijken",
};

const gemarkeerd = (x?: number) => (x ? ` (${x} gemarkeerd voor later)` : "");
const mv = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`;

export function tellerUitleg(k: TellerSleutel, t: Tellers): string {
  const n = t[k] ?? 0;
  switch (k) {
    case "aanvragen": return `${mv(n, "aanvraag wacht", "aanvragen wachten")} op beoordeling, activatie of certificaatverwerking${gemarkeerd(t.aanvragen_gemarkeerd)}`;
    case "leads": return `${mv(n, "lead is", "leads zijn")} nog niet opgevolgd${gemarkeerd(t.leads_gemarkeerd)}`;
    case "afgehaakt": return `${mv(n, "bezoeker haakte", "bezoekers haakten")} de afgelopen 7 dagen af tijdens het aanvragen`;
    case "opzeggingen": return `${mv(n, "opzegging moet", "opzeggingen moeten")} nog gekoppeld of verwerkt worden`;
    case "credits_akkoord": return `${mv(n, "creditnota wacht", "creditnota's wachten")} op akkoord`;
    case "service": return `${mv(n, "serviceaanvraag staat", "serviceaanvragen staan")} open`;
    case "screening": return `${mv(n, "screeningaanvraag staat", "screeningaanvragen staan")} open`;
    case "chat": return `${mv(n, "chatgesprek hoort", "chatgesprekken horen")} bij een nieuwe aanvraag`;
    case "facturatie": return `${mv(n, "factuur of Exact-taak", "facturen of Exact-taken")}: concept nog niet definitief of Exact-aanpassing open`;
    case "bav_nakijken": return `${mv(n, "BAV-nummer", "BAV-nummers")} uit de AFAS-import nog nakijken; geen haast, telt niet mee in het totaal`;
    case "machtigingen": return `${mv(n, "klant", "klanten")} met een machtiging om na te kijken; geen haast, telt niet mee in het totaal`;
    case "klanten": {
      const c = t.klanten_credits ?? 0, oud = t.klanten_credits_oud ?? 0, tk = t.klanten_taken ?? 0;
      const delen = [] as string[];
      if (c) delen.push(`${mv(c, "creditnota loopt", "creditnota's lopen")} vast: ${oud ? `${oud} uit het oude systeem` : ""}${oud && c - oud ? ", " : ""}${c - oud ? `${c - oud} zonder Exact-koppeling of artikel` : ""}`);
      if (tk) delen.push(`${mv(tk, "klant heeft", "klanten hebben")} een nieuwe aanvraag nodig`);
      return delen.join("; ") || `${n} openstaand`;
    }
  }
}

/** Groepstotaal: alleen wat iemand nu moet doen (grijze tellers niet). */
export function groepsTotaal(sleutels: (TellerSleutel | undefined)[], t: Tellers): number {
  return sleutels.reduce((s, k) => s + (k && !GRIJZE_TELLERS.has(k) ? t[k] ?? 0 : 0), 0);
}

/** Eerste item met een rode teller: daar opent een klik op het groepstotaal. */
export function groepsDoel(sleutels: (TellerSleutel | undefined)[], t: Tellers): string | null {
  const k = sleutels.find((s) => s && !GRIJZE_TELLERS.has(s) && (t[s] ?? 0) > 0);
  return k ? TELLER_DOEL[k] : null;
}

export function groepsUitleg(sleutels: (TellerSleutel | undefined)[], t: Tellers): string {
  return sleutels.filter((s): s is TellerSleutel => !!s && !GRIJZE_TELLERS.has(s) && (t[s] ?? 0) > 0).map((s) => tellerUitleg(s, t)).join("; ");
}

export const CRM_UITLEG = (n: number) => `${n} ${n === 1 ? "punt" : "punten"} in CRM: mislukte polisacties (afgelopen 7 dagen) of pauzes langer dan 90 dagen zonder herinnering`;
