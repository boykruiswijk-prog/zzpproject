export const OPENAI_ADS_PIXEL = "SxHpKs2V6EgSyfvtYJwquQ";
export const OPENAI_ADS_ENDPOINT = `https://bzr.openai.com/v1/events?pid=${OPENAI_ADS_PIXEL}`;
export const openaiLeadEventId = (aanvraagId: string) => `bav_lead_${aanvraagId}`;

type Lead = { id: string; type: string; is_test: boolean | null; created_at: string; extra_data: unknown };
export function maakOpenaiLeadEvent(lead: Lead) {
  if (lead.is_test !== false || lead.type !== "verzekering_aanvraag") return null;
  const extra = lead.extra_data as { attributie?: { marketing_toestemming?: unknown; oppref?: unknown }; pagina?: unknown } | null;
  if (extra?.attributie?.marketing_toestemming !== true) return null;
  // Fixed public application URL: never forward query strings, customer paths or free text.
  const sourceUrl = "https://zpzaken.nl/bav-zzp";
  const timestamp = Date.parse(lead.created_at);
  if (!Number.isFinite(timestamp)) return null;
  const oppref = extra.attributie.oppref;
  return {
    id: openaiLeadEventId(lead.id), type: "lead_created", timestamp_ms: timestamp,
    action_source: "web", source_url: sourceUrl,
    ...(typeof oppref === "string" && /^[\w.~-]{1,300}$/.test(oppref) ? { oppref } : {}),
    data: { type: "customer_action" },
  };
}