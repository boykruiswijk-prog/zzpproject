// Eén lijst opzegredenen (register "Opzegredenen gelijktrekken", 12-11-2026).
// Byte-gelijk gespiegeld in supabase/functions/_shared/opzegRedenen.ts.
export type OpzegReden = { code: string; label: string; alleenBeheer?: boolean };

export const OPZEG_REDENEN: OpzegReden[] = [
  { code: "stoppen_loondienst", label: "Stoppen ondernemen/loondienst" },
  { code: "wijzigen_entiteit", label: "Wijzigen entiteit (BV, eenmanszaak..)" },
  { code: "pensioen", label: "Pensioen" },
  { code: "geen_opdracht", label: "(Tijdelijk) geen opdracht" },
  { code: "overlijden", label: "Overlijden" },
  { code: "beeindiging_zp", label: "Beëindiging vanuit ZP", alleenBeheer: true },
  { code: "overgestapt", label: "Overgestapt" },
  { code: "anders", label: "Andere reden (namelijk:)" },
];

/** Klantportaal: zonder redenen die alleen het team mag kiezen. */
export const OPZEG_REDENEN_PORTAAL = OPZEG_REDENEN.filter((r) => !r.alleenBeheer);

/** Beheer: alle redenen plus de bestaande verwerkingscode voor een eerdere opzegging. */
export const OPZEG_REDENEN_BEHEER: OpzegReden[] = [
  ...OPZEG_REDENEN,
  { code: "eerdere_opzegging", label: "Eerdere opzegging niet verwerkt" },
];

/** Oude codes en portaalteksten van voor 12-11-2026, alleen voor weergave en herkenning. */
export const OUDE_OPZEG_REDENEN: Record<string, string> = {
  opzegging_klant: "Opzegging klant",
  eerdere_opzegging: "Eerdere opzegging niet verwerkt",
  ondernemingswijziging: "Ondernemingswijziging",
  wanbetaling: "Wanbetaling",
  stoppen_onderneming: "Overlijden of stoppen onderneming",
  overig: "Overig",
  andere_reden: "Andere reden",
};

/** Oude portaalteksten (bijvoorbeeld uit een nog geopende oude pagina) naar de nieuwe code. */
const OUDE_PORTAAL_TEKST: Record<string, string> = {
  "Wijzigen entiteit (bijvoorbeeld omzetting naar BV)": "wijzigen_entiteit",
  "(Tijdelijke) loondienst": "stoppen_loondienst",
  "Stoppen met zelfstandig ondernemen": "stoppen_loondienst",
  "Anders": "anders",
};

export function isAndersCode(code: unknown): boolean {
  return code === "anders";
}

/** Code die een klant mag insturen, of null. beeindiging_zp en onbekende waarden geven null. */
export function portaalRedenCode(waarde: unknown): string | null {
  if (typeof waarde !== "string") return null;
  const code = OUDE_PORTAAL_TEKST[waarde] ?? waarde;
  return OPZEG_REDENEN_PORTAAL.some((r) => r.code === code) ? code : null;
}

export function opzegRedenLabel(code: unknown): string {
  if (typeof code !== "string" || !code) return "";
  return OPZEG_REDENEN_BEHEER.find((r) => r.code === code)?.label ?? OUDE_OPZEG_REDENEN[code] ?? code;
}

/** Weergave van een opgeslagen opzegging: label, anders oude code via fallback, anders de vrije tekst. */
export function opzegRedenTekst(details: { reden?: unknown; reden_label?: unknown } | null | undefined): string {
  if (!details) return "";
  if (typeof details.reden_label === "string" && details.reden_label) return details.reden_label;
  return opzegRedenLabel(details.reden);
}
