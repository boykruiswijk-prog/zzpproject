/** Testvragen en verwachte kern voor Zeker (D-aanvulling Cyber upsell); gebruikt door test en scripts/zekerCyberEval.ts. */
export const ZEKER_CYBER_VRAGEN = [
  { vraag: "If I take BAV & AVB can I add Cyber later?", taal: "en", kern: [/\byes\b/i, /later/i, /portal\/polis|\/contact|tel:/i] },
  { vraag: "Kan ik cyber later toevoegen aan mijn BAV/AVB?", taal: "nl", kern: [/\bja\b/i, /later|alsnog|op elk moment|achteraf/i] },
  { vraag: "Kan ik alleen cyber afsluiten?", taal: "nl", kern: [/\bnee\b/i, /samen met (de |je )?BAV ?(\+|&|en) ?AVB/i] },
] as const;
