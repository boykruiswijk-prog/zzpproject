// @vitest-environment node
import { describe, expect, it } from "vitest";
import { maakOpenaiLeadEvent, openaiLeadEventId, OPENAI_ADS_ENDPOINT } from "../../supabase/functions/_shared/openaiAdsEvent";
const lead = { id: "1e7e88a6-1b6a-41a3-a423-e2eea008adcd", type: "verzekering_aanvraag", is_test: false, created_at: "2026-10-27T12:24:00Z", extra_data: { attributie: { marketing_toestemming: true, oppref: "original.opaque~id", email: "never@example.test" }, pagina: "https://zpzaken.nl/bav-zzp?email=never@example.test" } };
describe("OpenAI serverconversieregels", () => {
  it("weigert is_test", () => expect(maakOpenaiLeadEvent({ ...lead, is_test: true })).toBeNull());
  it("weigert onbekende teststatus", () => expect(maakOpenaiLeadEvent({ ...lead, is_test: null })).toBeNull());
  for (const consent of [false, undefined, "true"]) it(`vereist opgeslagen boolean akkoord ${String(consent)}`, () => expect(maakOpenaiLeadEvent({ ...lead, extra_data: { attributie: { marketing_toestemming: consent } } })).toBeNull());
  it("weigert andere formulieren", () => expect(maakOpenaiLeadEvent({ ...lead, type: "contact" })).toBeNull());
  it("gebruikt exact dezelfde ID als de pixel", () => expect(maakOpenaiLeadEvent(lead)?.id).toBe(openaiLeadEventId(lead.id)));
  it("stuurt uitsluitend toegestane gegevens en oorspronkelijke oppref", () => expect(maakOpenaiLeadEvent(lead)).toEqual({ id: `bav_lead_${lead.id}`, type: "lead_created", timestamp_ms: 1793103840000, action_source: "web", source_url: "https://zpzaken.nl/bav-zzp", oppref: "original.opaque~id", data: { type: "customer_action" } }));
  it("stuurt ook zonder oppref en zonder user-object", () => expect(maakOpenaiLeadEvent({ ...lead, extra_data: { attributie: { marketing_toestemming: true } } })).toEqual({ id: `bav_lead_${lead.id}`, type: "lead_created", timestamp_ms: 1793103840000, action_source: "web", source_url: "https://zpzaken.nl/bav-zzp", data: { type: "customer_action" } }));
  it("gebruikt het officiële endpoint en pixel-ID", () => expect(OPENAI_ADS_ENDPOINT).toBe("https://bzr.openai.com/v1/events?pid=SxHpKs2V6EgSyfvtYJwquQ"));
});