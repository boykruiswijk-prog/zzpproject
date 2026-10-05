import type { MouseEvent } from "react";

export const AANVRAAG_ID = "combinatiepolis";

/** Scrollt soepel naar het aanvraagformulier als dat op deze pagina staat. Geeft true terug als dat gelukt is. */
export function scrollNaarAanvraag(e?: MouseEvent): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(AANVRAAG_ID);
  if (!el) return false;
  e?.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}#${AANVRAAG_ID}`);
  return true;
}
