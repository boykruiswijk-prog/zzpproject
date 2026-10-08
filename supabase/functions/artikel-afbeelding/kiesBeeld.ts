// Pure keuze AI-illustratie of terugval. Nooit throwen: elke fout leidt tot terugval.
export type Keuring = { accepted: boolean; reason: string };
export type Keuze = { image?: string; reason: string | null; attempts: number; structureel: boolean };

export async function kiesBeeld(
  genereer: ((attempt: number) => Promise<string>) | null,
  keur: (image: string) => Promise<Keuring>,
  isStructureel: (e: unknown) => boolean,
): Promise<Keuze> {
  if (!genereer) return { reason: 'AI-sleutel ontbreekt', attempts: 0, structureel: true };
  let reason: string | null = null, attempts = 0, structureel = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    attempts = attempt;
    try {
      const candidate = await genereer(attempt);
      const review = await keur(candidate);
      if (review.accepted) return { image: candidate, reason: null, attempts, structureel: false };
      reason = review.reason;
    } catch (e) {
      reason = e instanceof Error ? e.message : 'Beeldgeneratie mislukt';
      // Weigering of toegangsfout: niet opnieuw proberen, direct terugval voor dit artikel.
      if (isStructureel(e)) { structureel = true; break; }
    }
  }
  return { reason, attempts, structureel };
}
