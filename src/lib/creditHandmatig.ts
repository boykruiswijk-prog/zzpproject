// Creditnota's uit het oude systeem (vóór 13-10-2026) die het team handmatig in AFAS afhandelt.
type C = { status: string; melding: string | null };
export const isOudSysteemCredit = (c: C) => (c.melding ?? "").includes("oud systeem");
/** Zelfde regel als RPC credit_handmatig_afgehandeld. */
export const magHandmatigAfhandelen = (c: C) =>
  isOudSysteemCredit(c) && !["verwerkt", "handmatig_afgehandeld", "niet_crediteren", "concept_aangemaakt", "geclaimd"].includes(c.status);
