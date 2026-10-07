# Beheer-UI

- Dashboardtellers komen uitsluitend uit RPC dashboard_tellers (klanten/contracten uit klant_contracten, leads uit leads). Waarom: één definitie zonder dubbele bronnen.
- Admin onder lg: Sheet-menu en kaartlijsten; desktop vaste zijbalk. Waarom: één navigatie.
- Universele beheerzoekfunctie loopt alleen via RPC zoek_universeel (rolcheck verzekering/supervisor/admin, IBAN gemaskeerd, IBAN-zoekacties in sensitive_audit_log); UI in src/components/admin/UniverseleZoeker.tsx, ook gebruikt door KoppelZoeker. Waarom: één zoeklogica zonder ruwe tabeltoegang.
