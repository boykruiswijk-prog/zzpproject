export const HANDMATIGE_ONTVANGST = "Je aanvraag is ontvangen en wordt nu beoordeeld. In sommige gevallen kunnen we een aanvraag niet accepteren; daar hoor je dan van ons. Na akkoord ontvang je je certificaat, je SEPA-machtiging en een uitnodiging voor Mijn ZP.";

export function handmatigeAanvraag(lead: { vereist_handmatige_beoordeling?: boolean | null; extra_data?: unknown }): boolean {
  const extra = lead.extra_data && typeof lead.extra_data === "object" ? lead.extra_data as Record<string, unknown> : {};
  return lead.vereist_handmatige_beoordeling === true || !!extra.handmatige_acceptatie;
}

export function beoordelingKeuze(extraData: unknown): { akkoord: boolean; geenSepa: boolean } {
  const extra = extraData && typeof extraData === "object" ? extraData as Record<string, unknown> : {};
  const ha = extra.handmatige_acceptatie && typeof extra.handmatige_acceptatie === "object" ? extra.handmatige_acceptatie as Record<string, unknown> : {};
  return { akkoord: typeof ha.bevestigd_op === "string" && !!ha.bevestigd_op, geenSepa: ha.geen_sepa_nodig === true };
}

/** Human approval and document completion are separate from financial activation. */
export function aanvraagDocumenten(lead: { vereist_handmatige_beoordeling?: boolean | null; extra_data?: unknown }, moment: "ontvangst" | "akkoord", geenSepa = false) {
  const handmatig = handmatigeAanvraag(lead);
  const vrijgegeven = !handmatig || moment === "akkoord";
  return { sepa: vrijgegeven && !(handmatig && geenSepa), certificaat: moment === "akkoord", mijnZp: moment === "akkoord", handmatig };
}