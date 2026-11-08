# A8 scherm en ticker: cronruis, 8 november 2026

## Resultaat
- Alleen de schermprojectie gewijzigd, niet de mailwachtrij, cronplanning, mailfuncties of bronlogs.
- Cron 369 uit het werklog is inmiddels cron 371, `process-email-queue`, actief iedere vijf seconden. Dit is ongewijzigd teruggelezen.
- Voor herstel: 103 regels `Mailwachtrij verwerkt` in vijftien minuten. Na herstel: nul lege cron- of technische hartslagregels in de afgelopen dertig minuten.
- Succesvolle cron-transportcallbacks zijn geen bewijs van werkelijk werk en komen niet meer in de schermprojectie. Echte resultaatgebeurtenissen blijven. Cronfouten blijven zichtbaar, evenals bestaande gezondheidscontroles.
- Ook gewone Hartslag/Puls-controles en Opvolger-rondes met nul nieuwe/tweede signalen vallen weg. Echte opvolgsignalen en fouten blijven.
- Alleen `status=sent` uit de verzendlogs telt. Identieke verzend-ID’s worden ontdubbeld, ook tussen beide bronnen. Eén stabiele scherm-ID per vijftienminutenblok; extra mails verhogen dezelfde regel, geen nieuwe puls-ID.
- Werkelijke feed toont onder meer `1 mails verstuurd` en `2 mails verstuurd`, elk in zijn eigen kwartier. Geen persoonsgegevens uit de verzendlogs gaan naar het scherm.
- Filtering vindt plaats vóór de 120/40/14-regellimieten, zodat echte aanvragen niet achter vijfsecondenruns verdwijnen. Scherm, ticker en werkstand gebruiken dezelfde projectie.

## Controle
- Nieuwe lokale PostgreSQL-regressietest eerst tegen de oude projectie: vier fouten, één geslaagd.
- Gerichte scherm/privacy/ticker/werkstandcontrole: 25 geslaagd. Daarna aanvullende Puls-varianten meegenomen; scherm- en artikelafbeeldingcontroles: 10 geslaagd.
- Volledige suite definitief met beperkte parallelle belasting: 240 bestanden, **2651 geslaagd, 0 gefaald, 1 overgeslagen**.
- Eerdere volle runs overschreden alleen de tijdslimiet voor lokale database-initialisatie en bestaande afbeeldingsrendering. Databasehook lokaal 60 seconden; geen productiecode omzeild. Beide controles daarna groen.
- Laatste automatische bouwcontrole: `build OK`, 08:17:50 UTC. Afzonderlijke typecheck en volledige productiebuild niet bevestigd door beschikbare automatische signalen; niet handmatig uitgevoerd.
- Aangemelde browsercontrole `/scherm`, 1280×1800: bestaande lege preview, nul zichtbare teksttekens. Daarom geen visueel/eind-tot-eind succes geclaimd. Beveiliging niet omzeild. De live schermprojectie wel teruggelezen, nul routine-regels.

## Ellen en publicatie
- Precies één melding: `432ed721-8d7c-4e8c-b5de-8462f89af04f`, onderdeel `admin`, actie `null`.
- Teruggelezen: gemaild op 08:15:14 UTC; mail-log `c2c43287-a178-4aa1-8881-f82f52c4f322`.
- Niet gepubliceerd. De databaseprojectie is al toegepast, dus bestaande schermen ontvangen de opgeschoonde feed bij verversen.

## Gewijzigde bestanden
- `drizzle/migrations/0261_scherm_cronruis.sql`
- `drizzle/migrations/0262_scherm_puls_heartbeat.sql`
- `drizzle/migrations/meta/0261_snapshot.json`
- `drizzle/migrations/meta/0262_snapshot.json`
- `drizzle/migrations/meta/_journal.json`
- `src/test/schermCronRuis.test.ts`
- `supabase/functions/_shared/AGENTS.md`
- `roadmap.md`
- `docs/scherm-cronruis-20261108.md`

Projectgeheugen bijgewerkt met Boys schermregel. Gegenereerde typen automatisch vernieuwd door de migratietool, zonder inhoudelijk verschil. Laatste functionele commit vóór rapportafronding: `e7649861`; commits worden automatisch beheerd.