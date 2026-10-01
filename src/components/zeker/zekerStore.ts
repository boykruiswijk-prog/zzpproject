// Klein gedeeld open/dicht-signaal voor chatassistent Zeker (zit in de hoofdbundel).
import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

export function zetZekerOpen(v: boolean) {
  open = v;
  listeners.forEach((l) => l());
}

export function useZekerOpen() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => open, () => false);
}

/** Paden waar de chat nooit verschijnt. */
export function zekerVerborgenOp(pathname: string): boolean {
  const p = pathname.replace(/^\/(nl|en|de|fr)(?=\/|$)/, "") || "/";
  return ["/admin", "/portal", "/mijn-zp", "/screenshot-helper"].some((x) => p === x || p.startsWith(`${x}/`));
}

export const COOKIE_KEUZE_EVENT = "zp-cookie-keuze";
export function cookieKeuzeGemaakt(): boolean {
  try { return !!localStorage.getItem("zpzaken_cookie_consent"); } catch { return true; }
}
