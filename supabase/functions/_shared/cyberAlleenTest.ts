/** Server-derived mode: client flags never enable real effects or bypass MFA. */
export function cyberGateBesluit(config: { actief?: boolean; modus?: string } | null, isTest: boolean, menselijkeMfa: boolean) {
  const modus = config?.modus ?? "uit";
  if (modus === "alleen_test") {
    if (!menselijkeMfa) return { toegestaan: false, droog: true, reden: "Menselijke teambeoordeling met tweestapsverificatie vereist" };
    if (!isTest) return { toegestaan: false, droog: true, reden: "Alleen gemarkeerde E4-testpolissen toegestaan; echte polissen zijn geblokkeerd" };
    return { toegestaan: true, droog: true, reden: "" };
  }
  if (!isTest && !config?.actief) return { toegestaan: false, droog: false, reden: "Cyberactivatie is nog niet vrijgegeven" };
  return { toegestaan: true, droog: isTest, reden: "" };
}