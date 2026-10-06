# CRM-afspraken

- CRM-notities/beeindigen/ondernemingswijziging alleen via crm_*-RPC's (crm_beeindig hergebruikt plan_opzeg_credit); bijlagen privaat in klant-documenten/notities/<id>/ via signed URL. Waarom: zelfde opzegpad, niets verwijderen, geaudit.
- BAV-nummer komt uit view crm_bav_nummers via src/lib/bavNummer.ts (volgorde site-certificaat, AFAS abonnement_nr, opgave klant; HPI. apart als Hiscox); contractstatus voor weergave via contractEindStatus (einddatum vandaag of eerder = beeindigd, alleen contract zonder einddatum krijgt Beeindigen). Waarom: overal hetzelfde nummer en geen dubbele beeindiging.
- CRM-dossier combineert client-leesbare bronnen met RPC crm_dossier (factuurplanning, creditnota's, mails, certificaten); lead-testmarkering alleen via RPC zet_lead_test. Waarom: team ziet alles zonder directe leesrechten op planning en maillog.
