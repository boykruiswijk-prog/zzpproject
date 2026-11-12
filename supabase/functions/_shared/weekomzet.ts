// Besluit Boy 12-11-2026 (vervangt A8 Dagomzet): Weekomzet op het Live-scherm.
// Nieuwe jaarpremie uit aanvragen van maandag 00:00 tot nu (Europe/Amsterdam), vergeleken met
// dezelfde periode vorige week (maandag tot dezelfde weekdag en hetzelfde tijdstip).
// Pure TypeScript; alleen totalen en aantallen verlaten de server, nooit regels per klant.
import { aanvraagJaarpremie } from "./dagomzet.ts";

const TZ = "Europe/Amsterdam";
/** Lokale Amsterdamse tijd als sorteerbare tekst "YYYY-MM-DD HH:mm:ss" (zomer- en wintertijd veilig). */
export function amsterdamLokaal(d: Date): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
const dagMin = (dag: string, n: number) => {
  const d = new Date(`${dag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};
/** Maandag (YYYY-MM-DD) van de Amsterdamse week waarin `nu` valt. */
export function maandagVan(nu = new Date()): string {
  const dag = amsterdamLokaal(nu).slice(0, 10);
  const wd = new Date(`${dag}T12:00:00Z`).getUTCDay(); // 0 = zondag
  return dagMin(dag, (wd + 6) % 7);
}

export type Weekomzet = { week_van: string; bedrag: number; aantal: number; vorige_bedrag: number; vorige_aantal: number; verschil_pct: number | null; via_advertenties: number; vorige_via_advertenties: number };
export const ADVERTENTIE_KANALEN = ["betaald", "chatgpt_ads"];

/** Rijen uit scherm_weekomzet_rijen: pakket, tarief_type, moment (ISO), kanaal. */
export function berekenWeekomzet(rijen: unknown, nu = new Date()): Weekomzet {
  const lijst = Array.isArray(rijen) ? rijen : [];
  const maandag = maandagVan(nu);
  const lokaalNu = amsterdamLokaal(nu);
  const vorigeMaandag = dagMin(maandag, 7);
  const vorigeEind = `${dagMin(lokaalNu.slice(0, 10), 7)}${lokaalNu.slice(10)}`;
  let bedrag = 0, aantal = 0, vb = 0, va = 0, adv = 0, vadv = 0;
  for (const r of lijst) {
    const t = Date.parse(r?.moment);
    if (!Number.isFinite(t)) continue;
    const l = amsterdamLokaal(new Date(t));
    const premie = aanvraagJaarpremie(r?.pakket, r?.tarief_type);
    const advertentie = ADVERTENTIE_KANALEN.includes(String(r?.kanaal ?? ""));
    if (l >= `${maandag} 00:00:00` && l <= lokaalNu) { bedrag += premie; aantal++; if (advertentie) adv++; }
    else if (l >= `${vorigeMaandag} 00:00:00` && l <= vorigeEind) { vb += premie; va++; if (advertentie) vadv++; }
  }
  bedrag = Math.round(bedrag); vb = Math.round(vb);
  return { week_van: maandag, bedrag, aantal, vorige_bedrag: vb, vorige_aantal: va, verschil_pct: verschilPct(bedrag, vb), via_advertenties: adv, vorige_via_advertenties: vadv };
}

/** Verschil in procenten t.o.v. vorige week, afgerond op hele procenten; null als vorige week 0 was. */
export function verschilPct(nu: number, vorig: number): number | null {
  if (!Number.isFinite(nu) || !Number.isFinite(vorig) || vorig <= 0) return null;
  return Math.round(((nu - vorig) / vorig) * 100);
}

/** Wat het scherm toont: na maandag 00:00 (Amsterdam) terug naar 0 tot er nieuwe data is. */
export function weekomzetWeergave(w: Partial<Weekomzet> | null | undefined, nu = new Date()) {
  const getal = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : 0);
  if (!w || w.week_van !== maandagVan(nu)) return { bedrag: 0, aantal: 0, vorige_bedrag: 0, verschil_pct: null as number | null };
  return { bedrag: getal(w.bedrag), aantal: getal(w.aantal), vorige_bedrag: getal(w.vorige_bedrag), verschil_pct: typeof w.verschil_pct === "number" && Number.isFinite(w.verschil_pct) ? Math.round(w.verschil_pct) : null };
}

/** Week-op-week voor een cumulatieve reeks (Google Ads klikken): stand nu min stand zondag ervoor, en hetzelfde een week eerder. */
export type Meetpunt = { dag: string; waarde: number };
const standOp = (reeks: Meetpunt[], dag: string) => {
  const kandidaat = reeks.filter((p) => p.dag <= dag).sort((a, b) => b.dag.localeCompare(a.dag))[0];
  return kandidaat ? kandidaat.waarde : null;
};
export function weekCumulatief(reeks: Meetpunt[]): { deze: number | null; vorige: number | null } {
  if (!reeks.length) return { deze: null, vorige: null };
  const laatste = [...reeks].sort((a, b) => b.dag.localeCompare(a.dag))[0];
  const maandag = maandagVan(new Date(`${laatste.dag}T12:00:00Z`));
  const verschil = (eind: number | null, begin: number | null) => (eind === null || begin === null || eind < begin ? null : eind - begin);
  return {
    deze: verschil(laatste.waarde, standOp(reeks, dagMin(maandag, 1))),
    vorige: verschil(standOp(reeks, dagMin(laatste.dag, 7)), standOp(reeks, dagMin(maandag, 8))),
  };
}
/** Week-op-week voor een momentopname (organische klikken, AI-zichtbaarheid): laatste stand en de stand een week eerder. */
export function weekStand(reeks: Meetpunt[]): { deze: number | null; vorige: number | null } {
  if (!reeks.length) return { deze: null, vorige: null };
  const laatste = [...reeks].sort((a, b) => b.dag.localeCompare(a.dag))[0];
  return { deze: laatste.waarde, vorige: standOp(reeks, dagMin(laatste.dag, 7)) };
}
