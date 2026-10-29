import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

/** Centrale Nederlandse labels voor leadstatussen in het beheer. */
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nieuw: "Nieuw",
  nieuw_te_beoordelen: "Te beoordelen",
  in_behandeling: "In behandeling",
  afspraak_gepland: "Afspraak gepland",
  offerte_verstuurd: "Offerte verstuurd",
  klant: "Klant",
  actief: "Polis actief",
  gepauzeerd: "Gepauzeerd",
  opgezegd: "Opgezegd",
  afgewezen: "Afgewezen",
  afgerond: "Afgerond (uitkomst onbekend)",
  klant_geworden: "Klant geworden",
  geen_interesse: "Geen interesse",
  vraag_beantwoord: "Vraag beantwoord",
};

/** Uitleg (title/tooltip) bij leadstatussen waar het label alleen niet genoeg zegt. */
export const LEAD_STATUS_TITELS: Partial<Record<LeadStatus, string>> = {
  actief: "De aanvraag is geactiveerd en de polis loopt",
  afgerond: "De actie is volledig afgehandeld; dit zegt niets over een polis",
  klant_geworden: "Lead is klant geworden; bij een verzekeringsaanvraag loopt dit via activeren (Polis actief)",
  geen_interesse: "Lead heeft afgezien of reageert niet meer",
  vraag_beantwoord: "Contactvraag zonder verkoopkans, vraag is beantwoord",
};

/** A23-aanvulling 3: uitkomsten bij het afsluiten van een lead. "afgerond" is niet meer kiesbaar, bestaande records blijven. */
export const LEAD_UITKOMSTEN = ["klant_geworden", "geen_interesse", "vraag_beantwoord"] as const;
export type LeadUitkomst = (typeof LEAD_UITKOMSTEN)[number];
/** Afgesloten leadstatussen: afgerond (oud) plus de drie uitkomsten. */
export const AFGESLOTEN_LEAD_STATUSSEN: LeadStatus[] = ["afgerond", ...LEAD_UITKOMSTEN];
export const isUitkomst = (s: string): s is LeadUitkomst => (LEAD_UITKOMSTEN as readonly string[]).includes(s);

export function statusTitel(raw: string | null | undefined): string | undefined {
  return raw ? (LEAD_STATUS_TITELS as Record<string, string>)[raw] : undefined;
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  nieuw: "bg-blue-100 text-blue-800",
  nieuw_te_beoordelen: "bg-blue-100 text-blue-800",
  in_behandeling: "bg-yellow-100 text-yellow-800",
  afspraak_gepland: "bg-purple-100 text-purple-800",
  offerte_verstuurd: "bg-orange-100 text-orange-800",
  klant: "bg-green-100 text-green-800",
  actief: "bg-green-100 text-green-800",
  gepauzeerd: "bg-gray-100 text-gray-800",
  opgezegd: "bg-gray-200 text-gray-700",
  afgewezen: "bg-red-100 text-red-800",
  afgerond: "bg-slate-100 text-slate-700",
  klant_geworden: "bg-green-100 text-green-800",
  geen_interesse: "bg-gray-100 text-gray-700",
  vraag_beantwoord: "bg-slate-200 text-slate-800",
};

/** Overige statussen (service, screening, Wet DBA). */
const OVERIGE_STATUS_LABELS: Record<string, string> = {
  verzonden: "Verzonden",
  afgerond: "Afgerond",
  behandeld: "Behandeld",
  open: "Open",
  analyzed: "Geanalyseerd",
  certified: "Gecertificeerd",
  pending: "In afwachting",
};

/** Leesbaar label voor elke ruwe statuswaarde; onbekend → eerste letter hoofdletter, _ → spatie. */
export function statusLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const bekend = (LEAD_STATUS_LABELS as Record<string, string>)[raw] ?? OVERIGE_STATUS_LABELS[raw];
  if (bekend) return bekend;
  const s = raw.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
