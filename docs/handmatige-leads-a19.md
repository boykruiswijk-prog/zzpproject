# A19 handmatige leads en klantkoppeling

## Gebouwd
- Knop Lead toevoegen bij Leads en Aanvragen. Eigen handmatig-type, bron, maker, interesse, notitie, optionele bestaande Later-vlag.
- MFA-only dubbelcheck op e-mail, telefoonformaten en KvK. Openen of bewust toch nieuw; opnieuw servercontrole bij opslaan.
- Handmatige prospects maken niet automatisch een tweede klantkaart via de oude persoons-trigger.
- Koppel aan klant op leaddetail en afgehaakte aanvragen, universele klantzoekfunctie, contactpersoonkeuze, expliciete bevestiging. Canonieke kaart bij samenvoeging.
- Leadstatus klant en converted_at bij koppeling; concept behoudt zijn eigen conceptstatus en krijgt koppeling/converted_at, zonder extra BAV-aanvraag te maken.
- Ontkoppelen uitsluitend Ellen of supervisor/admin, verplichte reden, historie en activiteitenlog behouden. Contactpersonen worden niet verwijderd.
- Bestaande publieke BAV-aanvraagwizard opent met MFA-only voorinvulling. Er bestond geen aparte BAV-aanvraag-namens-klant-schermroute; de bestaande sitewizard wordt gebruikt. Geen akkoord, SEPA of bankgegevens vooraf ingevuld, geen indiening tijdens tests.
- Leads-opbouw telt handmatig plus bron, nooit doel 200 of conversienoemer. Dashboard en scherm_data delen tel_dashboard_opbouw; beide payloads controleren sluitend totaal.

## Bewijs
- 67 gerichte tests geslaagd: 13 SQL-regeltests, 5 pure regels, 2 schermgedragstests, 19 universeelzoeken, 10 dashboard, 11 snelle-start, 7 vlag.
- Automatische bouwcontrole: build OK 26 oktober 14:48:52 UTC.
- Live KvK-functie OPTIONS200 / onbevoegd POST401, scherm-data OPTIONS200 / POST405.
- Echt aangemelde controle eindigde op admin/login?stap=instellen met Fout bij instellen 2FA. Geen MFA omzeild of testrecords aangemaakt in productie. SQL-route lokaal met gemarkeerde records getest.
- Niet-test Leads op moment controle: 40 totaal = 24 aanvragen + 12 contact + 4 offerte + 0 handmatig. Geen echte klantgegevens aangepast.
- Ellen-melding b75d0d79-1765-480d-ae04-89cbaf03d9fd, gemaild 14:49:05.904 UTC.

## Deploy en open controles
Migraties 0193-0196 toegepast, kvk-basisprofiel en scherm-data gedeployed. Websitepublicatie niet uitgevoerd: vijf bestaande kritieke Exact-bevindingen vragen Boys keuze of deze eerst aangepakt moeten worden. Nieuwe websiteversie niet geclaimd. Hosted aanmaken, koppelhistorie teruglezen, ontkoppelen en voorinvulling als echte gebruiker vereisen werkende MFA.

Geen klantmails, Exact-writes of verwijderingen.