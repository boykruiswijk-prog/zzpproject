# Cyber spoed 26 oktober

## Oorzaak en observatie
- Edge HTTP-log: drie POST 400 naar cyber-toevoegen-activeren om 12:15:11, 12:15:16, 12:17:08 UTC; geen call naar generate-cyber-certificate. Alle drie vóór mutaties en dus zonder activiteiten_log.
- Bestaande 400-body uit de bron: `Ongeldige beoordeling`. SDK/UI toont daarvoor `Edge Function returned a non-2xx status code`. Historische response-body is niet opgeslagen; Ellens scherm kon niet rechtstreeks worden geopend met Boys aal1-sessie. Browser toont `Fout bij instellen 2FA` en blijft op `/admin/login?stap=instellen&next=%2Fadmin`.
- Geldig UUID/boolean wordt door UI aangeleverd; de beoordelingstoelichting is een afzonderlijk leeg veld, niet de al opgeslagen `Telefonisch contact`. Onder 10 tekens weigert de functie vóór lezen/beoordelen/activeren.
- Jaarmaximum is 5.000.000 en livevlag true; niet de oorzaak van deze drie 400's. Pieter: geldig BAV-certificaat, actieve jaarcontractregel vanaf 23-10, Exact-koppeling aanwezig, geen facturatieblokkade.

## Herstel
- Client valideert beoordeling 10-1000 tekens vóór invoke en leest server-body in plaats van SDK-fout.
- Edge gebruikt dezelfde grens met duidelijke 400; certificaat transport-/niet-JSON-fouten leveren wachten op document op, geen mislukte activatie of mail.
- CYBER_AKKOORD voor nieuwe invoer: `Ik begrijp dat cyber een looptijd van 12 maanden heeft en daarna stilzwijgend wordt verlengd met 12 maanden. Al betaalde premie voor cyber krijg ik bij opzeggen niet terug. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.`
- Beide SQL-routes uit dezelfde bron gegenereerd (0181); E6 blijft identiek. Historische bewijsstukken niet gewijzigd.
- Oude tekst: verzoeken `e4104723-0000-4000-8000-000000000006` (test), `33de661d-d747-4300-a6f8-1c993caac333` (test), `d6a43c5f-8cff-4be8-9844-b5b696892c26` (echt); aanvraagbewijs lead `edcec306-dc16-42af-b016-002610202601` (test).

## Bewijs en grenzen
- 55 gerichte Vitest-tests + 19 vervolgtests (3 overlappend): 71 unieke; Deno 5 handlerregels en 2 echte lokale PDF-tests groen. Jaar EUR250 / maand EUR27,50, eigen 12 maanden, nul echte mails/Exact in droge tests.
- Volledige suite: 1538 groen, 2 bestaande wpInventory-redirectfouten, 1 skipped. Websitebuild OK.
- Deploy: cyber-toevoegen-activeren, generate-cyber-certificate, process-bav-wizard. Live OPTIONS 200 alle drie; sessieloze POST 401 bij beide cyberfuncties.
- Publicatie aangevraagd naar zpzaken.nl, geen klantgoedkeuring uitgevoerd. Eén Ellen-melding 83df8f42-97ea-459f-91d2-f8141b5b3d87.
- Echt aangemeld jaar/maand/planner/certificaatpad blijft onbewezen door MFA-instelfout; droge helpertests zijn geen live goedkeuringstest. Geen echte certificaten of klantmails gemaakt.