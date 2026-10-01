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
  actief: "Actief",
  gepauzeerd: "Gepauzeerd",
  opgezegd: "Opgezegd",
  afgewezen: "Afgewezen",
};

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
