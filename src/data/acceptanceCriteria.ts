// Acceptatie-criteria voor BAV-AVB polissen bij ZP Zaken.
// Wordt gebruikt in de aanvraag-wizard én bij heractivering.
// Match is case-insensitive en op substring (partial match).

export const AFGEWEZEN_FUNCTIE_KEYWORDS: string[] = [
  // Juridisch / financieel hoogrisico
  "advoca", "notaris", "accountant", "fiscalist",
  // Medisch
  "arts", "medisch", "chirurg", "tandarts", "huisarts", "verloskund",
  "psycholoog", "psychiater", "fysiotherap",
  // Veiligheid / wapens
  "beveilig", "wapen", "bewak",
  // Vervoer
  "taxi", "koerier", "chauffeur",
  // Bouw / techniek met fysieke risico's
  "bouw", "dakdekk", "elektric", "loodgiet", "stukadoor", "metsel",
  "putjesschep", "rioolwerk", "asbest", "stratenmaker",
  // Horeca / events (afwijkend acceptatiekader)
  "horeca", "kok", "barkeep",
];

export const AFGEWEZEN_BRANCHE_VALUES: string[] = [
  "bouw", "horeca", "medisch", "transport",
];

export interface AcceptanceResult {
  accepted: boolean;
  reason?: string;
  matchedKeyword?: string;
}

export function checkAcceptance(
  functie: string | null | undefined,
  branche?: string | null,
): AcceptanceResult {
  const fn = (functie ?? "").toLowerCase().trim();
  if (!fn) return { accepted: false, reason: "Functie is verplicht." };

  const hit = AFGEWEZEN_FUNCTIE_KEYWORDS.find((k) => fn.includes(k));
  if (hit) {
    return {
      accepted: false,
      matchedKeyword: hit,
      reason: `Voor de functie '${functie}' kunnen we helaas geen polis aanbieden. Neem contact op via 020-4573077 voor de mogelijkheden.`,
    };
  }

  if (branche) {
    const br = branche.toLowerCase().trim();
    if (AFGEWEZEN_BRANCHE_VALUES.includes(br)) {
      return {
        accepted: false,
        matchedKeyword: br,
        reason: `Voor de branche '${branche}' kunnen we helaas geen standaardpolis aanbieden. Neem contact op via 020-4573077.`,
      };
    }
  }

  return { accepted: true };
}
