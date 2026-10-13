# Beheer-UI

- Aantallen (klanten, contracten, service open, aanvragen doel) alleen via SQL tel_* functies, gedeeld door dashboard_tellers, mijn_acties_vandaag, scherm_data en scherm_stromen; nooit getallen uit marketing_snapshot-tekst. Waarom: dashboard en tv tonen altijd hetzelfde.
- Admin onder lg: Sheet-menu en kaartlijsten; desktop vaste zijbalk. Waarom: één navigatie.
- Universele beheerzoekfunctie loopt alleen via RPC zoek_universeel (rolcheck verzekering/supervisor/admin, IBAN gemaskeerd, IBAN-zoekacties in sensitive_audit_log); UI in src/components/admin/UniverseleZoeker.tsx, ook gebruikt door KoppelZoeker. Waarom: één zoeklogica zonder ruwe tabeltoegang.
- KVK: elke bevraging via haalKvkProfiel in _shared/kvk.ts (formaat, cache kvk_profielen 30 dagen, schakelaar integratie_config 'kvk_api', limieten kvk_instellingen, claim per nummer, alleen Basisprofiel, log kvk_opvraag_log met kosten_eur); alleen na echte aanvraag of teamknop, nooit vanuit het openbare formulier; KVK-oordeel startertarief is een voorstel; KVK-waarden apart in ondernemingen.kvk_*, eigen naam/adres alleen via kvk_gegevens_overnemen. Waarom: geen onnodige kosten, misbruik of ongevraagd overschrijven.

- Serviceaanvragen bijwerken alleen via RPC service_aanvraag_status/afronden/notitie (src/lib/serviceAanvraag.ts), fout bij 0 rijen. Waarom: geen stille RLS-weigering.
- Volledig IBAN in beheer alleen via RPC iban_inzien (component IbanInzien), standaard gemaskeerd, elke inzage in sensitive_audit_log. Waarom: inzage herleidbaar, naar buiten altijd gemaskeerd.
- Leadvlag (later/actie) alleen via RPC zet_lead_vlag/verwijder_lead_vlag (trigger guard_lead_vlag); "geparkeerd" = SQL lead_vlag_geparkeerd, byte-gelijk aan isGeparkeerd in src/lib/leadVlag.ts. Waarom: tabs, tellers en dagoverzicht hanteren één regel.
