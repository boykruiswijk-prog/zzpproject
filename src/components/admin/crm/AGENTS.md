# CRM-afspraken

- CRM-notities/beeindigen/ondernemingswijziging alleen via crm_*-RPC's (crm_beeindig hergebruikt plan_opzeg_credit); bijlagen privaat in klant-documenten/notities/<id>/ via signed URL. Waarom: zelfde opzegpad, niets verwijderen, geaudit.
- BAV-nummer komt uit view crm_bav_nummers via src/lib/bavNummer.ts (volgorde site-certificaat, AFAS abonnement_nr, opgave klant; HPI. apart als Hiscox); contractstatus voor weergave via contractEindStatus (einddatum vandaag of eerder = beeindigd, alleen contract zonder einddatum krijgt Beeindigen). Waarom: overal hetzelfde nummer en geen dubbele beeindiging.
- CRM-dossier combineert client-leesbare bronnen met RPC crm_dossier (factuurplanning, creditnota's, mails, certificaten); lead-testmarkering alleen via RPC zet_lead_test. Waarom: team ziet alles zonder directe leesrechten op planning en maillog.
- Dubbele opzegregels worden gekoppeld via klant_service_aanvragen.gekoppeld_aan (nooit verwijderd); lijsten filteren gekoppeld_aan IS NULL en crm_beeindig werkt een bestaand opzegverzoek bij. Waarom: een opzegging is een regel.
- Klantgegevens wijzigen alleen via RPC crm_gegevens_wijzigen (audit, tijdlijnnotitie, crm_taken 'exact_aanpassen'); facturatietaken gaan naar team_taakverdeling.facturatie. Waarom: Exact nooit automatisch, wel een taak.
- Menutellers uitsluitend uit RPC menu_tellers (status, zonder testdata). Offertes alleen via Edge Function send-offerte; status offerte_verstuurd pas na echte verzending. Waarom: tellers en status onafhankelijk van wie klikt.
