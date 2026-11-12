// Wet DBA-score (besluit Boy 12-11-2026): de onderbouwing van de score moet altijd kloppen.
// Eén regel voor analyse, KVK-check, poliscontrole, handmatige wijziging en certificeren.
// score = max(0, 100 - 10 x aantal aandachtspunten). Lijst is deterministisch en ontdubbeld.
// Dit bestand staat byte-gelijk in src/lib/dbaScore.ts en supabase/functions/_shared/dbaScore.ts.

export type DbaDocStatus = "aanwezig" | "niet_aanwezig" | "niet_van_toepassing" | "niet_ingevuld";

export interface DbaChecklistItem {
  document_name: string;
  status: string;
  manually_overridden?: boolean;
}

export interface DbaScoreInvoer {
  velden: Record<string, unknown>;
  checklist: DbaChecklistItem[];
  kvk: { apart_geupload: boolean; extract_datum?: string | null; match?: boolean | null };
  polis: {
    apart_geupload: boolean;
    gelezen: boolean;
    datum?: string | null;
    has_bav?: boolean | null;
    has_avb?: boolean | null;
    formulier_datum?: string | null;
  };
  peildatum: Date;
}

export interface DbaPunt { soort: string; tekst: string }

export interface DbaScoreUitkomst {
  score: number;
  aandachtspunten: string[];
  punten: DbaPunt[];
  rode_vlaggen: string[];
}

export const DBA_VERPLICHTE_VELDEN: Array<{ kolom: string; label: string; alternatief?: string }> = [
  { kolom: "client_name", label: "Naam ZP kandidaat" },
  { kolom: "opdrachtgever", label: "Opdrachtgever" },
  { kolom: "eindopdrachtgever", label: "Eindopdrachtgever" },
  { kolom: "functie", label: "Functie" },
  { kolom: "rewritten_description", label: "Opdrachtomschrijving", alternatief: "project_description" },
  { kolom: "project_name", label: "Project" },
  { kolom: "startdatum", label: "Startdatum" },
  { kolom: "einddatum", label: "Einddatum" },
  { kolom: "optie_verlenging", label: "Optie tot verlenging" },
  { kolom: "uurtarief", label: "Uurtarief" },
  { kolom: "uren_per_week", label: "Aantal uur per week" },
  { kolom: "specifieke_vaardigheden", label: "Specifieke vaardigheden, kennis en opleiding" },
];

export type DbaDocSleutel = "overeenkomst" | "identiteit" | "cv" | "kvk" | "polis" | "vog" | "vca";

export const DBA_DOCUMENTEN: Record<DbaDocSleutel, string> = {
  overeenkomst: "Overeenkomst Eindopdrachtgever",
  identiteit: "Identiteits verklaring",
  cv: "Curriculum Vitae",
  kvk: "Uittreksel Kamer van Koophandel",
  polis: "Polis beroeps en bedrijfsaansprakelijkheid",
  vog: "VOG verklaring",
  vca: "VCA certificering",
};

/** Canonieke documentsleutel bij een rij- of documentnaam; null = geen bekend document. */
export function dbaDocSleutel(naam: string): DbaDocSleutel | null {
  const n = ` ${naam.toLowerCase().replace(/\s+/g, " ")} `;
  if (/vca (basis|vol)|vil vcu/.test(n)) return null;
  if (/kamer van koophandel|[^a-z]kvk[^a-z]/.test(n)) return "kvk";
  if (/polis|aansprakelijkheid/.test(n)) return "polis";
  if (/identiteit/.test(n)) return "identiteit";
  if (/curriculum|[^a-z]cv[^a-z]/.test(n)) return "cv";
  if (/[^a-z]vog[^a-z]/.test(n)) return "vog";
  if (/[^a-z]vca[^a-z]/.test(n)) return "vca";
  if (/overeenkomst/.test(n)) return "overeenkomst";
  return null;
}

function leeg(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

function geldigeDatum(s?: string | null): Date | null {
  if (!s || s === "null" || s === "undefined") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function nlDatum(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
}

function dagStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function minMaanden(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() - n);
  return r;
}

const STATUS_TEKST: Record<string, string> = {
  niet_aanwezig: "niet aanwezig",
  niet_van_toepassing: "niet van toepassing",
  niet_ingevuld: "niet ingevuld",
};

export function computeScore(invoer: DbaScoreInvoer): DbaScoreUitkomst {
  const punten: DbaPunt[] = [];
  const peil = dagStart(invoer.peildatum);

  // 1. Per leeg verplicht veld.
  for (const veld of DBA_VERPLICHTE_VELDEN) {
    const waarde = invoer.velden[veld.kolom];
    const alt = veld.alternatief ? invoer.velden[veld.alternatief] : undefined;
    if (leeg(waarde) && leeg(alt)) punten.push({ soort: "veld", tekst: `Verplicht veld is leeg: ${veld.label}` });
  }

  // 2. Per document niet als aanwezig aangevinkt (polis apart hieronder, KVK apart geupload telt als aanwezig).
  const gezien = new Set<string>();
  let polisAangevinkt = false;
  for (const item of invoer.checklist) {
    const naam = (item.document_name || "").trim();
    if (!naam) continue;
    const sleutel = dbaDocSleutel(naam);
    if (sleutel === "polis") {
      if (item.status === "aanwezig") polisAangevinkt = true;
      continue;
    }
    const id = sleutel ?? naam.toLowerCase().replace(/\s+/g, " ");
    if (gezien.has(id)) continue;
    gezien.add(id);
    if (sleutel === "kvk" && invoer.kvk.apart_geupload) continue;
    if (item.status === "aanwezig") continue;
    const label = sleutel ? DBA_DOCUMENTEN[sleutel] : naam;
    punten.push({ soort: "document", tekst: `${label} is niet als aanwezig aangevinkt (${STATUS_TEKST[item.status] ?? "niet ingevuld"})` });
  }

  // 3. KVK-uittreksel ouder dan 3 maanden (1x).
  const kvkDatum = geldigeDatum(invoer.kvk.extract_datum);
  if (kvkDatum && kvkDatum < minMaanden(peil, 3)) {
    punten.push({ soort: "kvk_oud", tekst: `KVK-uittreksel is ouder dan 3 maanden (datum: ${nlDatum(kvkDatum)})` });
  }

  // 4. Polis: gelezen polis gaat voor het vinkje, nooit dubbel.
  const p = invoer.polis;
  const polisDatumNiet = { soort: "polis_datum", tekst: "Datum polis beroeps- en bedrijfsaansprakelijkheid kon niet worden vastgesteld" };
  const polisOud = (d: Date) => {
    if (d < minMaanden(peil, 12)) punten.push({ soort: "polis_oud", tekst: `Polis beroeps- en bedrijfsaansprakelijkheid is ouder dan 1 jaar (datum: ${nlDatum(d)})` });
  };
  if (p.gelezen) {
    const d = geldigeDatum(p.datum);
    if (d) polisOud(d); else punten.push(polisDatumNiet);
    const bav = p.has_bav === true;
    const avb = p.has_avb === true;
    if (!bav && !avb) punten.push({ soort: "polis_dekking", tekst: "Polis dekt geen beroepsaansprakelijkheid (BAV) en geen bedrijfsaansprakelijkheid (AVB)" });
    else if (!bav) punten.push({ soort: "polis_dekking", tekst: "Polis dekt geen beroepsaansprakelijkheid (BAV)" });
    else if (!avb) punten.push({ soort: "polis_dekking", tekst: "Polis dekt geen bedrijfsaansprakelijkheid (AVB)" });
  } else if (p.apart_geupload) {
    punten.push(polisDatumNiet);
  } else if (polisAangevinkt) {
    const d = geldigeDatum(p.formulier_datum);
    if (d) polisOud(d); else punten.push(polisDatumNiet);
  } else {
    punten.push({ soort: "polis_ontbreekt", tekst: "Polis beroeps- en bedrijfsaansprakelijkheid is niet aangeleverd" });
  }

  // Rode vlag apart, telt niet mee in de score.
  const rode_vlaggen: string[] = [];
  if (invoer.kvk.match === false) rode_vlaggen.push("Werkzaamheden passen niet bij de KVK-inschrijving");

  const aandachtspunten = [...new Set(punten.map((x) => x.tekst))];
  return { score: Math.max(0, 100 - 10 * aandachtspunten.length), aandachtspunten, punten, rode_vlaggen };
}

/** Bouw de invoer uit een dba_checks-rij en de (formulier)checklist. */
// deno-lint-ignore no-explicit-any
export function dbaScoreInvoer(check: any, checklist: DbaChecklistItem[], peildatum: Date): DbaScoreInvoer {
  const sug = Array.isArray(check?.suggestions) ? check.suggestions[0] ?? {} : {};
  const pr = sug?.polis_check_result ?? null;
  const kvk = check?.kvk_check_result ?? null;
  return {
    velden: check ?? {},
    checklist,
    kvk: {
      apart_geupload: Boolean(check?.kvk_file_url || check?.kvk_text),
      extract_datum: kvk?.kvk_extract_date ?? null,
      match: typeof kvk?.match === "boolean" ? kvk.match : null,
    },
    polis: {
      apart_geupload: Boolean(check?.polis_file_url || check?.polis_text),
      gelezen: Boolean(pr),
      datum: pr?.polis_date ?? null,
      has_bav: pr?.has_bav ?? null,
      has_avb: pr?.has_avb ?? null,
      formulier_datum: pr ? null : sug?.insurance_policy_date ?? null,
    },
    peildatum,
  };
}

/** Klopt de opgeslagen score met de opgeslagen lijst en met een verse berekening? */
export function dbaScoreControle(
  opgeslagenScore: unknown,
  opgeslagenLijst: unknown,
  vers: DbaScoreUitkomst,
): { ok: true } | { ok: false; melding: string } {
  const lijst = Array.isArray(opgeslagenLijst) ? opgeslagenLijst.filter((x) => typeof x === "string" && x.trim() !== "") as string[] : [];
  const score = typeof opgeslagenScore === "number" ? opgeslagenScore : null;
  if (score === null) return { ok: false, melding: "Er is geen opgeslagen score. Klik op Score herberekenen." };
  if (score !== Math.max(0, 100 - 10 * lijst.length)) {
    return { ok: false, melding: `De opgeslagen score (${score}%) past niet bij de ${lijst.length} opgeslagen aandachtspunten. Klik op Score herberekenen en controleer de punten.` };
  }
  const a = [...lijst].sort().join("\n");
  const b = [...vers.aandachtspunten].sort().join("\n");
  if (a !== b || score !== vers.score) {
    return { ok: false, melding: `De opgeslagen score (${score}%, ${lijst.length} punten) wijkt af van de berekening (${vers.score}%, ${vers.aandachtspunten.length} punten). Klik op Score herberekenen en controleer de punten.` };
  }
  return { ok: true };
}
