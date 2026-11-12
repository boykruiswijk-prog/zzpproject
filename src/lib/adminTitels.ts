// Centrale tabbladnamen voor /admin (spoed Ellen 12-11-2026 12:34).
// Bij elke routewissel wordt de titel direct gereset naar de standaardtitel van de pagina;
// een naam komt er pas bij als de geladen gegevens bij het id uit de URL horen.
import { useEffect, useLayoutEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";

export const ADMIN_TITEL_SUFFIX = "ZP Zaken admin";

/** Elk adminpad uit App.tsx met de standaardtitel. Specifieke paden vóór algemene. */
export const ADMIN_ROUTE_TITELS: ReadonlyArray<readonly [string, string]> = [
  ["/admin/login", "Inloggen"],
  ["/admin/wachtwoord-vergeten", "Wachtwoord vergeten"],
  ["/admin/wachtwoord-reset", "Wachtwoord opnieuw instellen"],
  ["/admin/reset-password", "Wachtwoord opnieuw instellen"],
  ["/admin/wachtwoord-wijzigen", "Wachtwoord wijzigen"],
  ["/admin", "Dashboard"],
  ["/admin/inzicht/:tegel", "Inzicht"],
  ["/admin/crm", "CRM"],
  ["/admin/activiteiten", "Activiteiten"],
  ["/admin/leads", "Leads"],
  ["/admin/aanvragen", "Aanvragen"],
  ["/admin/leads/:id", "Lead"],
  ["/admin/team", "Team"],
  ["/admin/dba-checks", "DBA-checks"],
  ["/admin/dba-checks/nieuw", "Nieuwe DBA-check"],
  ["/admin/dba-checks/bulk", "DBA-bulkcontrole"],
  ["/admin/dba-checks/bulk/:id", "DBA-bulkcontrole"],
  ["/admin/dba-checks/:id", "DBA-check"],
  ["/admin/screening-aanvragen", "Screeningaanvragen"],
  ["/admin/screening-aanvragen/:id", "Screeningaanvraag"],
  ["/admin/service-aanvragen", "Serviceaanvragen"],
  ["/admin/opzeggingen", "Opzeggingen"],
  ["/admin/portaltoegang", "Portaltoegang"],
  ["/admin/schermen", "Schermen"],
  ["/admin/creditnotas-goedkeuren", "Creditnota's goedkeuren"],
  ["/admin/bav-nummer-nakijken", "BAV-nummer nakijken"],
  ["/admin/machtigingen-nakijken", "Machtigingen nakijken"],
  ["/admin/service-aanvragen/:id", "Serviceaanvraag"],
  ["/admin/social-media", "Social media"],
  ["/admin/google-reviews", "Google-reviews"],
  ["/admin/marketing", "Marketing"],
  ["/admin/kennisbank", "Kennisbank"],
  ["/admin/kennisbank/actualiteit", "Kennisbank actualiteit"],
  ["/admin/kennisbank/nieuw", "Nieuw artikel"],
  ["/admin/kennisbank/:id", "Artikel bewerken"],
  ["/admin/opvolgen", "Opvolgen"],
  ["/admin/afgehaakt", "Afgehaakte aanvragen"],
  ["/admin/zoekrecord/:bron/:id", "Zoekresultaat"],
  ["/admin/klanten", "Klanten & contracten"],
  ["/admin/dubbele-klanten", "Dubbele klanten"],
  ["/admin/klanten/:id", "Klant"],
  ["/admin/personen/:id", "Persoon"],
  ["/admin/incassos", "Incasso's"],
  ["/admin/financieel-overzicht", "Financieel overzicht"],
  ["/admin/klantmails", "Klantmails"],
  ["/admin/aov-doorverwijzingen", "AOV-aanmeldingen"],
  ["/admin/facturatieplanning", "Facturatieplanning"],
  ["/admin/exact-reconciliatie", "Exact-reconciliatie"],
  ["/admin/chatgesprekken", "Chatgesprekken"],
  ["/admin/niet-gevonden", "Niet-gevonden pagina's"],
  ["/admin/wp-import", "WordPress-import"],
  ["/admin/integraties", "Integraties"],
  ["/admin/exact-koppeling", "Exact-koppeling"],
  ["/admin/interne-meldingen", "Interne meldingen"],
  ["/admin/activiteitenlog", "Activiteitenlog"],
];

export function adminPaginaNaam(pathname: string): string | null {
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return null;
  // Vaste paden winnen van paden met :id (zoals /admin/dba-checks/nieuw).
  const vast = ADMIN_ROUTE_TITELS.find(([p]) => !p.includes(":") && matchPath({ path: p, end: true }, pathname));
  const met = vast ?? ADMIN_ROUTE_TITELS.find(([p]) => matchPath({ path: p, end: true }, pathname));
  return met ? met[1] : "Beheer";
}

export const adminStandaardTitel = (pagina: string) => `${pagina} | ${ADMIN_TITEL_SUFFIX}`;
export const adminDetailTitel = (naam: string, pagina: string) => `${naam} | ${pagina} | ${ADMIN_TITEL_SUFFIX}`;

/** Eén keer in de router: reset de titel synchroon bij elke adminroutewissel, vóór data-effecten. */
export function AdminTitelBeheer() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const pagina = adminPaginaNaam(pathname);
    if (pagina) document.title = adminStandaardTitel(pagina);
  }, [pathname]);
  return null;
}

/**
 * Detailpagina: naam alleen in de titel als het id van de geladen gegevens gelijk is aan het id uit de URL.
 * Anders (laden, oude cache, ander record) blijft de standaardtitel staan.
 */
export function useAdminDetailTitel(naam: string | null | undefined, urlId: string | undefined, dataId: string | null | undefined) {
  const { pathname } = useLocation();
  useEffect(() => {
    const pagina = adminPaginaNaam(pathname);
    if (!pagina) return;
    const klopt = !!naam && !!urlId && dataId === urlId;
    document.title = klopt ? adminDetailTitel(naam!.trim(), pagina) : adminStandaardTitel(pagina);
  }, [naam, urlId, dataId, pathname]);
}
