import { kiesBavNummer, useBavRijen } from "@/lib/bavNummer";
import { BavNummer } from "./BavNummer";

/** BAV-nummer bij een lead: eigen certificaat, of via de gekoppelde onderneming (relatiecode). */
export function LeadBavNummer({ leadId, ondernemingIds = [] }: { leadId: string; ondernemingIds?: string[] }) {
  const { data } = useBavRijen(ondernemingIds, [leadId]);
  if (!data) return null;
  return <div className="mt-1"><BavNummer keuze={kiesBavNummer(data)} /></div>;
}
