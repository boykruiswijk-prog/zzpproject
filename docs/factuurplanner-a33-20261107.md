# Factuurplanner A33 punt 3, 7 november 2026

## Bestaand en toegevoegd
- Databasehistorie: 3 november 38 live runs; 4, 5 en 6 november elk 2; 7 november vóór deze controle 1.
- Bestaande correctie-/handmatige creditbescherming behouden; de echte gedeelde plannerberekening wordt getest met 60 tegenover de onjuiste jaarpremie 600.
- Nieuwe atomische databasegrens: vijf live runs per Nederlandse kalenderdag, alle triggers samen. Ook directe inserts worden begrensd; oude runs en proefruns tellen niet mee. Run zes stopt vóór kandidaatberekening, creditwijziging, Exact of mail en schrijft één database-logregel.
- Lege live runs stoppen vóór Exact, dagstand- en foutmails. Geen statuscontrole op Exact bij een lege run.
- Aanroep `factuur-planner` met `{"actie":"dryrun"}` of `{"dry_run":true}` geeft factuurbedragen per contract-periode en credits per sleutel, inclusief berekening, blokkade en voorbeeldpayload. Alleen bestaande beveiligde toegang, geen nieuwe publieke toegang.
- Droge run deelt de berekening met live, maar doet geen herbeoordeling, claim, statuswijziging, machineactiviteit, Exact-aanroep, tokenrefresh of mail. Rapporteert de opgeslagen momentopname; live Exact-sleutel/statuscontrole en ontbrekende grootboekopzoekingen worden niet nagebootst.
- Vervolgtaak blijft elke vijftien minuten uitsluitend bij resterend werk/voortgang en stopt bij de vijfde echte run of leegloop. Er is geen nieuwe permanente cron.

## Eenmalige besluiten
Zes registerverwijzingen in `eenmalige_besluiten` documenteren vijf klantgevallen. Geen plannerfilter op klantnaam of klant-id gevonden; geen gedragsregel verplaatst.

| Geval | Bestaande bron | Bevinding |
|---|---|---|
| Kinderman | Jaarcyclus in klant_contracten | Reeds gegevensgestuurd; geen naamregel in planner. |
| De Directietafel | Contract + audit en SQL-trigger uit 0237/0238 | Auditgebonden coulanceguard bestaat buiten planner; behouden. |
| Let's GO Labels | Contractoverdracht + algemene opvolgerroute | Geen klantfilter in planner; behouden. |
| Stadermann, cfo360 en Valhalla | Contractkorting + twee vaste creditrijen | Geen klantfilter in planner; bedrag en afhandeling behouden. |
| Digital Native | cyber_ingang_uitzonderingen | Reeds aparte uitzonderingsrij buiten planner; behouden. |

## Uitgevoerde droge run
De uitgerolde planner gaf HTTP 200 en modus dryrun: 16 factuurregels en 32 niet-testcreditregels beoordeeld; 0 aan te maken facturen, totaal 0; 0 aan te maken credits, totaal 0. Historische/afgehandelde credits blijven zichtbaar met hun eigen sleutel, bedrag en status. Geen Exact, mail of databasewrites in deze modus. De runhistorie bleef 86 rijen, laatste wijziging 7 november 05:00:40.930 UTC.

## Verificatie
Volledige suite: 2608 geslaagd, 1 bestaand overgeslagen. Een afbeeldingsrender-timeout in de eerste parallelle run slaagde afzonderlijk; herhaling van de volledige suite met twee workers was groen. Automatische buildcontrole moet aanvullend groen zijn; een afzonderlijke handmatige productiebuild/typecheck is niet uitgevoerd vanwege de verplichte automatische projectcontrole.