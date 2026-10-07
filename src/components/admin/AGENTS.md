# Beheer-UI

- Dashboardtellers komen uitsluitend uit RPC dashboard_tellers (klanten/contracten uit klant_contracten, leads uit leads). Waarom: één definitie zonder dubbele bronnen.
- Admin onder lg: Sheet-menu en kaartlijsten; desktop vaste zijbalk. Waarom: één navigatie.
- Universele beheerzoekfunctie loopt alleen via RPC zoek_universeel (rolcheck verzekering/supervisor/admin, IBAN gemaskeerd, IBAN-zoekacties in sensitive_audit_log); UI in src/components/admin/UniverseleZoeker.tsx, ook gebruikt door KoppelZoeker. Waarom: één zoeklogica zonder ruwe tabeltoegang.
- KVK is leidend voor naam/adres/inschrijvingsdatum: opvragen alleen via Edge Function kvk-basisprofiel en _shared/kvk.ts (cache kvk_profielen 30 dagen, log kvk_opvraag_log); KVK-waarden staan apart in ondernemingen.kvk_*, eigen naam/adres wijzigen alleen via RPC kvk_gegevens_overnemen (admin), nooit Exact. Waarom: verschillen zichtbaar zonder ongevraagd overschrijven.
