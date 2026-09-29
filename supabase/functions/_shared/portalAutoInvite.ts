// Pure beslislogica voor de automatische Mijn ZP-uitnodiging (geen imports: ook
// door vitest getest in src/test/portalAutoInvite.test.ts).
export interface AutoInviteInput {
  isTest: boolean;
  email: string | null | undefined;
  exactAccountId: string | null | undefined;
  aantalPolissen: number;
  aantalUitnodigingen: number;
}
export type AutoInviteBesluit =
  | { versturen: true }
  | { versturen: false; reden: "niet_geactiveerd" | "geen_polis" | "al_uitgenodigd" | "testlead" };

/** Precies één keer per lead: alleen als geactiveerd én polis én nog nooit uitgenodigd. */
export function beslisAutoUitnodiging(i: AutoInviteInput): AutoInviteBesluit {
  if (!String(i.exactAccountId ?? "").trim()) return { versturen: false, reden: "niet_geactiveerd" };
  if (i.aantalPolissen < 1) return { versturen: false, reden: "geen_polis" };
  if (i.aantalUitnodigingen > 0) return { versturen: false, reden: "al_uitgenodigd" };
  const email = String(i.email ?? "").trim().toLowerCase();
  if (i.isTest && !email.endsWith("@zpzaken.nl")) return { versturen: false, reden: "testlead" };
  return { versturen: true };
}

/**
 * Claim-en-verstuur: alleen wie de claim-rij daadwerkelijk invoegt (insert … on
 * conflict do nothing op portal_auto_invite_claim) mag versturen. Mislukt het
 * versturen, dan wordt de claim weer vrijgegeven.
 */
export async function claimEnVerstuur<T extends { verzonden: boolean }>(deps: {
  claim: () => Promise<boolean>;
  release: () => Promise<void>;
  send: () => Promise<T>;
}): Promise<{ gewonnen: false } | ({ gewonnen: true } & { resultaat: T })> {
  if (!(await deps.claim())) return { gewonnen: false };
  let resultaat: T;
  try {
    resultaat = await deps.send();
  } catch (e) {
    await deps.release().catch(() => {});
    throw e;
  }
  if (!resultaat.verzonden) await deps.release().catch(() => {});
  return { gewonnen: true, resultaat };
}
