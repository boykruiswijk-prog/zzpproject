# Beheer-UI

- Aantallen (klanten, contracten, service open, aanvragen doel) alleen via SQL tel_* functies, gedeeld door dashboard_tellers, mijn_acties_vandaag, scherm_data en scherm_stromen; nooit getallen uit marketing_snapshot-tekst. Waarom: dashboard en tv tonen altijd hetzelfde.
- Admin onder lg: Sheet-menu en kaartlijsten; desktop vaste zijbalk. Waarom: één navigatie.
- Universele beheerzoekfunctie loopt alleen via RPC zoek_universeel (rolcheck verzekering/supervisor/admin, IBAN gemaskeerd, IBAN-zoekacties in sensitive_audit_log); UI in src/components/admin/UniverseleZoeker.tsx, ook gebruikt door KoppelZoeker. Waarom: één zoeklogica zonder ruwe tabeltoegang.
- KVK is leidend voor naam/adres/inschrijvingsdatum: opvragen alleen via Edge Function kvk-basisprofiel en _shared/kvk.ts (cache kvk_profielen 30 dagen, log kvk_opvraag_log); KVK-waarden staan apart in ondernemingen.kvk_*, eigen naam/adres wijzigen alleen via RPC kvk_gegevens_overnemen (admin), nooit Exact. Waarom: verschillen zichtbaar zonder ongevraagd overschrijven.

- Serviceaanvragen bijwerken alleen via RPC service_aanvraag_status/afronden/notitie (src/lib/serviceAanvraag.ts), fout bij 0 rijen. Waarom: geen stille RLS-weigering.
- Volledig IBAN in beheer alleen via RPC iban_inzien (component IbanInzien), standaard gemaskeerd, elke inzage in sensitive_audit_log. Waarom: inzage herleidbaar, naar buiten altijd gemaskeerd.
- docs/cloudflare-bulk-redirects.csv volgt bij elke build uit public/_redirects. Waarom: één bron.
