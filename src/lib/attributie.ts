// Legt bij het eerste bezoek in deze browsersessie de herkomst vast (alleen first-party,
// sessionStorage). Wordt meegestuurd met publieke formulieren → leads.extra_data.attributie.
import { ATTRIBUTIE_SLEUTELS, bepaalKanaal, schoneUrl, type Attributie } from "../../supabase/functions/_shared/attributie";

const KEY = "zp_attributie";

export function legAttributieVast(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(KEY)) return;
    const q = new URLSearchParams(window.location.search);
    const a: Record<string, string> = {};
    for (const k of ATTRIBUTIE_SLEUTELS) {
      const v = q.get(k);
      if (v) a[k] = v.slice(0, 200);
    }
    const ref = document.referrer ? schoneUrl(document.referrer) : "";
    if (ref && new URL(ref).host !== window.location.host) a.referrer = ref;
    a.landingspagina = window.location.pathname;
    a.eerste_bezoek_op = new Date().toISOString();
    sessionStorage.setItem(KEY, JSON.stringify({ ...a, kanaal: bepaalKanaal(a) }));
  } catch {
    /* geen opslag beschikbaar */
  }
}

export function leesAttributie(): Attributie | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Attributie) : null;
  } catch {
    return null;
  }
}
