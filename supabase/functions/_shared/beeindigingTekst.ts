// Creditnotazin in de bevestigingsmail bij beeindiging (D1-aanvulling, Boy 6-11-2026):
// lidmaatschappen krijgen nooit een creditnota, dus de mail belooft die dan ook niet.
export type BeeindigdSoort = "verzekering" | "lidmaatschap";

export function soortVanContract(type: string | null | undefined, product: string | null | undefined): BeeindigdSoort {
  if (type === "lidmaatschap" || String(product ?? "").startsWith("lidmaatschap")) return "lidmaatschap";
  return "verzekering";
}

export function creditZin(soorten: BeeindigdSoort[]): string {
  const lid = soorten.includes("lidmaatschap");
  const verz = soorten.includes("verzekering");
  if (lid && !verz) return "Voor een lidmaatschap ontvang je geen creditnota.";
  if (lid && verz) return "Is er voor je verzekering na die datum al iets gefactureerd, dan ontvang je daarvoor een creditnota. Voor een lidmaatschap ontvang je geen creditnota.";
  return "Is er na die datum al iets gefactureerd, dan ontvang je daarvoor een creditnota.";
}
