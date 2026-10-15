import { fiscaleCijfers as f } from "../data/fiscaleCijfers";
const positief = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
export const pensioenRegels = {
  maximumInkomen: f.maximumPensioengevendLoon.waarde,
  franchise: f.lijfrenteFranchise.waarde,
  percentage: f.jaarruimtePercentage.waarde / 100,
  reserveringMaximum: f.maximaleReserveringsruimte.waarde,
  aowAlleen: f.aowAlleenstaandJuli.waarde,
  aowSamen: f.aowSamenwonendJuli.waarde,
  aowLeeftijd: f.aowLeeftijd.waarde,
  uitkeringsjaren: f.lijfrenteMinimaleUitkering.waarde,
};
export function berekenJaarruimte({ winst, overig = 0, pensioen = 0, inleg = 0, reservering = 0 }: { winst: number; overig?: number; pensioen?: number; inleg?: number; reservering?: number }) {
  const inkomen = positief(winst) + positief(overig);
  const grondslag = Math.max(0, Math.min(inkomen, pensioenRegels.maximumInkomen) - pensioenRegels.franchise);
  const jaarruimte = Math.max(0, Math.round(pensioenRegels.percentage * grondslag) - positief(pensioen));
  const ruimte = jaarruimte + Math.min(positief(reservering), pensioenRegels.reserveringMaximum);
  const aftrekbaar = Math.min(positief(inleg), ruimte);
  const tarief = (inkomen <= f.schijf1Grens.waarde ? f.schijf1Tarief.waarde : inkomen <= f.schijf2Grens.waarde ? f.schijf2Tarief.waarde : f.schijf3Tarief.waarde) / 100;
  return { grondslag, jaarruimte, ruimte, aftrekbaar, tarief, teruggave: aftrekbaar * tarief, nietAftrekbaar: positief(inleg) > ruimte };
}
export function berekenPensioengat({ gewenst, samen = false, opgebouwd = 0, leeftijd }: { gewenst: number; samen?: boolean; opgebouwd?: number; leeftijd: number }) {
  const aow = samen ? pensioenRegels.aowSamen : pensioenRegels.aowAlleen;
  const gat = Math.max(0, positief(gewenst) - aow - positief(opgebouwd));
  const pot = gat * 12 * pensioenRegels.uitkeringsjaren;
  const jaren = Math.max(1, pensioenRegels.aowLeeftijd - positief(leeftijd));
  return { aow, gat, pot, jaren, inlegPerJaar: pot / jaren };
}
export const pensioenEuro = (n: number, decimalen = 0) => `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: decimalen, maximumFractionDigits: decimalen })}`;