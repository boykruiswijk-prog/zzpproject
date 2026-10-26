# Adminzoeken, Boy 26 oktober

## Oorzaak en herstel
De oude zoekfunctie doorzocht aanvraag_concepten helemaal niet, beperkte andere groepen tot 15/30 resultaten en verborg samengevoegde kaarten zonder hun oude naam naar de hoofdkaart te leiden.

Eén RPC zoek_universeel gebruikt nu een afgeschermde, expliciet toegestane bronlijst. Rollen verzekering/supervisor/admin blijven behouden, met expliciete aal2-controle. Geen browsertoegang tot de bronview, geen anon-EXECUTE. IBAN wordt alleen gemaskeerd teruggegeven; volledig IBAN en viercijferzoekacties krijgen altijd een audit, ook zonder match. Geen mutaties aan klantgegevens, mails, Exact of verwijderingen.

## Tabellen
leads, aanvraag_concepten, bav_aanmeldingen, ondernemingen, personen (met persoon_onderneming), klant_contracten, policies, klant_certificaten, cyber_toevoeg_verzoeken, klant_service_aanvragen, aov_aanmeldingen, screening_aanvragen, collective_signups, collective_suggestions, collective_newsletter, klant_mandaten, exact_mandaat_import, exact_telefoon_import, exact_email_import, invoices, portal_invitations, sepa_machtiging_bewijs, bav_nummer_bevestigingen, omzetting_beslissingen, onderneming_opvolging.

Terugbelverzoeken zijn leads/service-types, geen aparte terugbeltabel. Technische logs, auth, medewerkers, marketingartikelen en token-/afmeldtabellen zijn geen klant/prospectzoekbron. Oude importgegevens zijn alleen leesbaar, er wordt niets naar Exact geschreven.

## Velden en klikbestemmingen
Voornaam, achternaam, volledige naam, bedrijfsnaam, KvK-handelsnamen, e-mail, telefoon, KvK, postcode, BAV-/abonnements-/certificaat-/polisnummer, Exact-relatiecode, factuurnummer, mandaatkenmerk en IBAN waar de bron die velden heeft. Nederlandse telefoonformaten worden gelijkgetrokken; KvK, identificatienummers en IBAN worden compact gematcht. Deels en hoofdletterongevoelig. Status/type en standaard geen testrecords. BAV-nummer van de klant vindt ook later cyber.

Gegroepeerde resultaten openen klantkaart, lead, afgehaakte kaart, cyber bij Aanvragen, persoon, service of screening. Voor bronnen zonder eigen detailpagina bestaat een leesbare, zoekfunctie-beveiligde detailpagina; geen willekeurige tabeluitlezing.

## Bewijs
- 19 regressietests geslaagd: vijf telefoonformaten, contact-e-mail, BAV, oude samengevoegde naam, KvK-spaties, volledig/laatste-vier IBAN met masker/audit, audit zonder match, testfilter, MFA/niet-teamweigering, persooncontact, >1000 contracten zonder afkapping, cyber via BAV.
- Live database: 19 niet-test, niet-omgezette concepten met telefoon. Concept 653c0f87-7f59-4b1a-a546-78ba6d8d1acd heeft geen overeenkomstige leadtelefoon en valt daardoor in het eerdere zoekgat. Alle vijf formaten matchen in de toegepaste bron. Ellen gaf geen exact nummer; haar specifieke record kan niet uniek worden vastgesteld.
- Trigram-indexen voor tekst, genormaliseerde telefoonindexen, IBAN-laatste-vier-indexen. Testvolume 1001 contracten zonder Data API-limiet.
- Websitecontrole: build OK. Databasewijzigingen 0190-0192 toegepast, functies actief zonder afzonderlijke Edge Function-deploy.
- Aangemelde browsercontrole met Boys eigen geminte sessie: /admin/login?stap=instellen&next=%2Fadmin, bestaande melding "Fout bij instellen 2FA". Geen aal2-omzeiling; volledige echte UI-zoekklik blijft onbewezen.
- Publicatie aangevraagd voor zpzaken.nl; live bundelcontrole nog te bevestigen.