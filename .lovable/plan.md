# Plan: bevestigingsscherm BAV-AVB aanvraag

## Bevinding
- De bestaande succesroute zet `isSubmitted` wel op `true`, maar gebruikt dit alleen om een sluitbaar venster boven stap 5 te tonen.
- Daardoor blijft stap 5 achter het venster staan en komt de gebruiker na sluiten terug in de ingevulde wizard.
- De server retourneert al `lead_id`, maar nog niet het mandaatkenmerk.

## Uitvoering
1. Vervang bij `isSubmitted` de volledige wizard door één blijvend bevestigingsscherm met de opgegeven kop, tekst, referentie en knoppen.
2. Bewaar na succes de eerste acht hoofdletters van `lead_id` en het door de server teruggegeven mandaatkenmerk voor weergave.
3. Laat de server alleen het bestaande mandaatkenmerk extra teruggeven; voeg geen andere gevoelige gegevens toe.
4. Scroll het bevestigingsscherm in beeld en zet de toetsenbordfocus op de kop zodra de inzending slaagt.
5. Wis daarna de ingevulde formuliergegevens uit de browsersessie, zodat verversen weer stap 1 toont.
6. Test de succesroute met een gemockte inzending op telefoon- en desktopbreedte, zonder database-insert, Exact-aanroep of mail.
7. Voer de gerichte tests en typecheck uit en controleer de preview-build. Niet publiceren.

## Technische details
- De bestaande `isSubmitted`-route blijft de enige succesroute; het huidige succesvenster wordt verwijderd in plaats van aangevuld.
- De serverresponse krijgt `mandaatkenmerk`, afgeleid van het al vastgelegde bewijsrecord.
- De test onderschept de functieaanroep en retourneert fictieve succesdata.