import { attributieRegels } from "./attributie.ts";
// Eén bron voor "alles wat een bezoeker invult" bij een lead.
// - Formulieren sturen extra_data.formulier mee als geordende lijst [{label, waarde}]
//   (jsonb bewaart de volgorde van objectsleutels niet, een lijst wel).
// - Admin-leaddetail, leadlijst en interne meldingsmail lezen via deze helpers.
// Pure functies: geen Deno- of browser-API's, zodat frontend en Edge Functions dit delen.

export type FormVeld = { label: string; waarde: string };

const MAX_VELDEN = 80;
const MAX_LABEL = 80;
const MAX_WAARDE = 5000;

function tekst(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Ja" : "Nee";
  if (Array.isArray(v)) return v.map(tekst).filter(Boolean).join(", ");
  if (typeof v === "object") return "";
  return String(v).trim();
}

/** Server-side opschonen van extra_data.formulier uit een publieke inzending. */
export function saneerFormulier(input: unknown): FormVeld[] {
  if (!Array.isArray(input)) return [];
  const uit: FormVeld[] = [];
  for (const item of input.slice(0, MAX_VELDEN)) {
    if (!item || typeof item !== "object") continue;
    const label = tekst((item as Record<string, unknown>).label).slice(0, MAX_LABEL);
    const waarde = tekst((item as Record<string, unknown>).waarde).slice(0, MAX_WAARDE);
    if (label && waarde) uit.push({ label, waarde });
  }
  return uit;
}

/** Client: bouw het formulier-blok. Lege waarden worden overgeslagen. */
export function maakFormulier(velden: Array<[string, unknown]>): FormVeld[] {
  return velden
    .map(([label, v]) => ({ label, waarde: tekst(v) }))
    .filter((f) => f.waarde !== "");
}

export function saneerPagina(p: unknown): string | null {
  if (typeof p !== "string") return null;
  const s = p.trim().slice(0, 300);
  return s || null;
}

// ── Weergave ──

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIJD_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export function formatWaarde(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Ja" : "Nee";
  if (Array.isArray(v)) return v.map(formatWaarde).filter(Boolean).join(", ");
  if (typeof v === "object") return "";
  const s = String(v).trim();
  if (DATUM_RE.test(s)) { const [y, m, d] = s.split("-"); return `${d}-${m}-${y}`; }
  if (TIJD_RE.test(s)) {
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  return s;
}

const TYPE_LABELS: Record<string, string> = {
  contact: "Contact",
  verzekering_aanvraag: "Verzekeringsaanvraag",
  "offerte-aanvraag": "Offerteaanvraag",
};

/** Bezoekerskolommen van leads met Nederlands label. */
const KOLOM_LABELS: Record<string, string> = {
  geboortedatum: "Geboortedatum",
  beroep: "Beroep",
  omzet: "Jaaromzet / betaalwijze",
  verzekering_type: "Verzekering",
  verzekerd_bedrag: "Verzekerd bedrag",
  eigen_risico: "Eigen risico",
  ingangsdatum: "Ingangsdatum",
  gekozen_pakket: "Pakket",
  branche: "Branche (administratie)",
  iban: "IBAN",
  sepa_akkoord: "SEPA-machtiging akkoord",
  sepa_akkoord_datum: "SEPA-akkoord op",
  functie_bij_aanvraag: "Functie",
  vereist_handmatige_beoordeling: "Handmatige beoordeling nodig",
};

/** Overige (systeem)kolommen; alleen getoond in het blok Systeemgegevens. */
const SYSTEEM_LABELS: Record<string, string> = {
  bron: "Bron",
  status: "Status",
  updated_at: "Laatst bijgewerkt",
  assigned_to: "Toegewezen aan",
  converted_at: "Geconverteerd op",
  exact_status: "Exact-status",
  exact_relatie_id: "Exact-relatie-id",
  exact_relatie_code: "Exact-relatiecode",
  exact_account_id: "Exact-account",
  exact_abonnement_id: "Exact-abonnement",
  exact_sync_op: "Exact-sync op",
  exact_fout: "Exact-fout",
  geactiveerd_door: "Geactiveerd door",
  geactiveerd_op: "Geactiveerd op",
  exact_invoice_id: "Exact-factuur",
  exact_invoice_number: "Exact-factuurnummer",
  exact_invoice_amount: "Exact-factuurbedrag",
  exact_invoice_created_at: "Exact-factuur aangemaakt",
  exact_invoice_status: "Exact-factuurstatus",
  pauze_start_datum: "Pauze vanaf",
  pauze_reden: "Pauzereden",
  pauze_toelichting: "Pauzetoelichting",
  pauze_door: "Gepauzeerd door",
  pauze_reminder_verzonden_op: "Pauzeherinnering verzonden",
  opzeg_datum: "Opzegdatum",
  opzeg_reden: "Opzegreden",
  opzeg_toelichting: "Opzegtoelichting",
  opzeg_door: "Opgezegd door",
  heractivering_datum: "Heractivering",
  heractivering_door: "Geheractiveerd door",
  functie_bij_heractivering: "Functie bij heractivering",
  polis_einddatum: "Polis einddatum",
  exact_creditnota_id: "Exact-creditnota",
  exact_creditnota_amount: "Creditnotabedrag",
  exact_creditnota_created_at: "Creditnota aangemaakt",
  exact_credit_invoice_id_pauze: "Credit pauze",
  exact_credit_invoice_bedrag: "Creditbedrag pauze",
  exact_credit_invoice_aangemaakt_op: "Credit pauze aangemaakt",
  exact_factuur_id_hervat: "Factuur hervatting",
  exact_factuur_bedrag_hervat: "Bedrag hervatting",
  exact_factuur_aangemaakt_op_hervat: "Factuur hervatting aangemaakt",
  exact_credit_invoice_id_opzeg: "Credit opzegging",
  exact_credit_invoice_bedrag_opzeg: "Creditbedrag opzegging",
  exact_credit_invoice_aangemaakt_op_opzeg: "Credit opzegging aangemaakt",
};

const NIET_TONEN = new Set(["id", "created_at", "extra_data", "activatie_log", "is_test", "type", "voornaam", "achternaam", "email", "telefoon", "bedrijfsnaam", "kvk_nummer", "adres_straat", "adres_huisnummer", "adres_postcode", "adres_plaats", "opmerkingen"]);

const EXTRA_LABELS: Record<string, string> = {
  sector: "Sector",
  branche: "Sector (omschrijving)",
  belangrijkste_opdrachtgever: "Belangrijkste opdrachtgever",
  omschrijving_werkzaamheden: "Omschrijving werkzaamheden",
  adres_land: "Land",
  adres_postcode: "Postcode",
  adres_huisnummer: "Huisnummer",
  aantal_medewerkers: "Aantal medewerkers",
  gewenste_startdatum: "Gewenste startdatum",
  getoonde_documenten: "Getoonde documenten",
  documenten_bevestigd_op: "Documenten bevestigd op",
  bron: "Bron (formulier)",
  chat_sessie_id: "Chatsessie",
  voorkeursmoment: "Voorkeursmoment",
  toestemming: "Toestemming terugbellen",
  toestemming_op: "Toestemming op",
};
const EXTRA_NIET_TONEN = new Set(["formulier", "formulier_naam", "pagina", "aantal_medewerkers_num"]);

function mooiLabel(key: string): string {
  const s = key.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Bekende "Sleutel: waarde"-regels uit opmerkingen van oude leads. */
const OPMERKING_SLEUTELS = [
  "Onderwerp", "Rekeninghouder", "Sector", "Opdrachtgever", "Bemiddelaar", "Aantal medewerkers",
  "Functie", "Aantal leden", "Voorkeursmoment", "Vraag", "Via bemiddelaar",
];

export function parseOpmerkingen(opm: unknown): FormVeld[] {
  if (typeof opm !== "string" || !opm.trim()) return [];
  const uit: FormVeld[] = [];
  for (const regel of opm.split(/\r?\n/)) {
    const m = regel.match(/^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{1,30}):\s*(.+?)\s*$/);
    if (!m) continue;
    const sleutel = OPMERKING_SLEUTELS.find((k) => k.toLowerCase() === m[1].trim().toLowerCase());
    if (!sleutel) continue;
    let waarde = m[2];
    // Oud collectief-formaat: "Aantal leden: 12. vrije tekst"
    if (sleutel === "Aantal leden") waarde = waarde.split(/\.\s/)[0].replace(/\.$/, "");
    if (waarde && waarde !== "-") uit.push({ label: sleutel, waarde });
  }
  return uit;
}

export type LeadWeergave = {
  naam: string;
  email: string;
  telefoon: string;
  contact: FormVeld[];
  aanvraag: FormVeld[];
  formulier: FormVeld[];
  overig: FormVeld[];
  systeem: FormVeld[];
  bericht: string;
  heeftFormulier: boolean;
};

// deno-lint-ignore no-explicit-any
type Rec = Record<string, any>;

export function leadWeergave(lead: Rec): LeadWeergave {
  const extra: Rec = lead?.extra_data && typeof lead.extra_data === "object" && !Array.isArray(lead.extra_data) ? lead.extra_data : {};
  const formulier = saneerFormulier(extra.formulier);
  const parsed = parseOpmerkingen(lead.opmerkingen);
  const p = (label: string) => parsed.find((f) => f.label === label)?.waarde ?? "";
  const gebruiktKol = new Set<string>();
  const gebruiktExtra = new Set<string>();
  const gebruiktParsed = new Set<string>();
  const kol = (k: string) => { const w = formatWaarde(lead[k]); if (w) gebruiktKol.add(k); return w; };
  const ex = (k: string) => { const w = formatWaarde(extra[k]); if (w) gebruiktExtra.add(k); return w; };
  const pa = (k: string) => { const w = p(k); if (w) gebruiktParsed.add(k); return w; };
  const eerste = (...w: string[]) => w.find(Boolean) ?? "";

  const naam = [lead.voornaam, lead.achternaam].filter((x) => x && x !== "-").join(" ").trim();
  const straat = [lead.adres_straat, lead.adres_huisnummer].filter(Boolean).join(" ");
  const pcPlaats = [lead.adres_postcode, lead.adres_plaats].filter(Boolean).join(" ");
  let adres = [straat, pcPlaats].filter(Boolean).join(", ");
  if (adres) ["adres_straat", "adres_huisnummer", "adres_postcode", "adres_plaats"].forEach((k) => gebruiktKol.add(k));
  if (!adres && (extra.adres_postcode || extra.adres_huisnummer)) {
    adres = [ex("adres_postcode"), ex("adres_huisnummer"), ex("adres_land")].filter(Boolean).join(" ");
  }

  const rij = (label: string, waarde: string): FormVeld[] => (waarde ? [{ label, waarde }] : []);
  const contact: FormVeld[] = [
    ...rij("Naam", naam),
    ...rij("E-mail", String(lead.email ?? "").trim()),
    ...rij("Telefoon", String(lead.telefoon ?? "").trim()),
    ...rij("Bedrijfsnaam", String(lead.bedrijfsnaam ?? "").trim()),
    ...rij("KvK-nummer", String(lead.kvk_nummer ?? "").trim()),
    ...rij("Adres", adres),
    ...rij("Geboortedatum", kol("geboortedatum")),
  ];

  const omzet = String(lead.omzet ?? "");
  const betaalwijze = ["maandelijks", "jaarlijks"].includes(omzet) ? omzet.charAt(0).toUpperCase() + omzet.slice(1) : "";
  if (betaalwijze) gebruiktKol.add("omzet");

  const aanvraag: FormVeld[] = [
    ...rij("Type", TYPE_LABELS[lead.type] ?? String(lead.type ?? "")),
    ...rij("Formulier", formatWaarde(extra.formulier_naam)),
    ...rij("Pagina", formatWaarde(extra.pagina)),
    ...rij("Ontvangen", formatWaarde(lead.created_at)),
    ...rij("Onderwerp", pa("Onderwerp")),
    ...rij("Verzekering", kol("verzekering_type")),
    ...rij("Pakket", kol("gekozen_pakket")),
    ...rij("Betaalwijze", betaalwijze),
    ...rij("Ingangsdatum", eerste(kol("ingangsdatum"), ex("gewenste_startdatum"))),
    ...rij("Verzekerd bedrag", kol("verzekerd_bedrag")),
    ...rij("Sector", eerste(ex("branche"), ex("sector"), pa("Sector"))),
    ...rij("Branche (administratie)", kol("branche")),
    ...rij("Beroep", kol("beroep")),
    ...rij("Functie", eerste(kol("functie_bij_aanvraag"), pa("Functie"))),
    ...rij("Opdrachtgever", eerste(ex("belangrijkste_opdrachtgever"), pa("Opdrachtgever"))),
    ...rij("Aantal medewerkers", eerste(ex("aantal_medewerkers"), pa("Aantal medewerkers"))),
    ...rij("Aantal leden", pa("Aantal leden")),
    ...rij("Voorkeursmoment terugbellen", eerste(ex("voorkeursmoment"), pa("Voorkeursmoment"))),
    ...attributieRegels(extra.attributie).flatMap(([l, w]) => rij(l, w)),
  ];
  gebruiktExtra.add("attributie");
  if (extra.sector && extra.branche) gebruiktExtra.add("sector");

  const shown = new Set([...contact, ...aanvraag].map((f) => `${f.label}|${f.waarde}`));
  const overig: FormVeld[] = [];
  const voeg = (label: string, waarde: string) => {
    if (!waarde || shown.has(`${label}|${waarde}`)) return;
    shown.add(`${label}|${waarde}`);
    overig.push({ label, waarde });
  };
  for (const [k, label] of Object.entries(KOLOM_LABELS)) if (!gebruiktKol.has(k) && lead[k] !== false) voeg(label, formatWaarde(lead[k]));
  for (const f of parsed) if (!gebruiktParsed.has(f.label)) voeg(f.label, f.waarde);
  for (const [k, v] of Object.entries(extra)) {
    if (EXTRA_NIET_TONEN.has(k) || gebruiktExtra.has(k)) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Rec)) voeg(`${EXTRA_LABELS[k] ?? mooiLabel(k)} – ${mooiLabel(k2)}`, formatWaarde(v2));
    } else voeg(EXTRA_LABELS[k] ?? mooiLabel(k), formatWaarde(v));
  }

  const systeem: FormVeld[] = [];
  for (const [k, v] of Object.entries(lead)) {
    if (NIET_TONEN.has(k) || KOLOM_LABELS[k]) continue;
    const w = formatWaarde(v);
    if (w) systeem.push({ label: SYSTEEM_LABELS[k] ?? mooiLabel(k), waarde: w });
  }

  return {
    naam, email: String(lead.email ?? "").trim(), telefoon: String(lead.telefoon ?? "").trim(),
    contact, aanvraag, formulier, overig, systeem,
    bericht: typeof lead.opmerkingen === "string" ? lead.opmerkingen.trim() : "",
    heeftFormulier: formulier.length > 0,
  };
}

/** Korte omschrijving voor de leadlijst: onderwerp of eerste regel van het bericht. */
export function leadOnderwerp(lead: Rec): string {
  const parsed = parseOpmerkingen(lead?.opmerkingen);
  const ond = parsed.find((f) => f.label === "Onderwerp")?.waarde;
  if (ond) return ond;
  const formOnd = saneerFormulier(lead?.extra_data?.formulier).find((f) => /onderwerp/i.test(f.label))?.waarde;
  if (formOnd) return formOnd;
  const eersteRegel = String(lead?.opmerkingen ?? "").split(/\r?\n/).map((r) => r.trim()).find(Boolean) ?? "";
  return eersteRegel.length > 140 ? `${eersteRegel.slice(0, 137)}…` : eersteRegel;
}

export function maskeerIban(iban: string): string {
  const s = iban.replace(/\s+/g, "");
  return s.length > 8 ? `${s.slice(0, 4)} •••• ${s.slice(-4)}` : "••••";
}

/** Velden voor de interne teammail: e-mail en telefoon bovenaan, IBAN gemaskeerd. */
export function interneMailVelden(lead: Rec): { velden: Array<[string, string]>; bericht: string } {
  const w = leadWeergave(lead);
  const rijen: Array<[string, string]> = [];
  const gezien = new Set<string>();
  const add = (l: string, v: string) => {
    if (!v) return;
    const val = /iban/i.test(l) ? maskeerIban(v) : v;
    const key = `${l}|${val}`;
    if (gezien.has(key)) return;
    gezien.add(key); rijen.push([l, val]);
  };
  add("E-mail", w.email);
  add("Telefoon", w.telefoon);
  for (const f of w.contact) add(f.label, f.waarde);
  for (const f of w.aanvraag) add(f.label, f.waarde);
  for (const f of w.formulier) add(f.label, f.waarde);
  for (const f of w.overig) add(f.label, f.waarde);
  return { velden: rijen, bericht: w.bericht };
}
