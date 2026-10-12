import { supabase } from "@/integrations/supabase/client";
import { isNietGemetenPad } from "./tracking";

// Anonieme live-meting voor het interne scherm: alleen het type pagina, geen cookies of persoonsgegevens.
export type BezoekCategorie = "home" | "verzekeringen" | "offerte" | "starters" | "beroep" | "kennisbank" | "collectief" | "contact" | "mijn_zp";

const VERZEKERINGEN = ["/verzekeringen", "/diensten", "/bav-zzp", "/bav-zzp-vergelijken", "/aov", "/pensioen", "/zorgverzekering", "/beroepsaansprakelijkheidsverzekering", "/mentale-gezondheid"];
const KENNISBANK_OVERZICHT = ["wet-en-regelgeving", "ondernemen", "belastingen", "financien", "verzekeringen"];

/** Paginacategorie voor een pad, of null als het pad niet meetelt. */
export function categorieVoorPad(pathname: string): BezoekCategorie | null {
  if (isNietGemetenPad(pathname)) return null;
  const p = (pathname.replace(/^\/(nl|en|de|fr)(?=\/|$)/, "") || "/").replace(/\/+$/, "") || "/";
  if (p === "/") return "home";
  if (VERZEKERINGEN.includes(p)) return "verzekeringen";
  if (p === "/offerte") return "offerte";
  if (p === "/starters") return "starters";
  if (/^\/zzp-verzekering-[a-z-]+$/.test(p)) return "beroep";
  const kb = p.match(/^\/kennisbank\/([^/]+)$/);
  if (kb && !KENNISBANK_OVERZICHT.includes(kb[1])) return "kennisbank";
  if (p === "/collectieve-inkoop" || p === "/collectief-ledenorganisaties") return "collectief";
  if (p === "/contact") return "contact";
  return null;
}

/** Geautomatiseerde browsers en crawlers tellen nooit mee. */
export function isBot(nav: { webdriver?: boolean; userAgent?: string } | undefined): boolean {
  if (!nav) return true;
  if (nav.webdriver) return true;
  return /bot|crawl|spider|slurp|headless|lighthouse|prerender|preview/i.test(nav.userAgent ?? "");
}

/** Fire-and-forget na een idle-moment; fouten worden altijd ingeslikt. */
export function meldSiteBezoek(categorie: BezoekCategorie | null) {
  if (!categorie || typeof window === "undefined" || isBot(navigator)) return;
  const stuur = () => {
    try {
      supabase.rpc("site_bezoek", { _categorie: categorie }).then(() => undefined, () => undefined);
    } catch { /* nooit zichtbaar */ }
  };
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(stuur, { timeout: 5000 });
  else window.setTimeout(stuur, 2000);
}
