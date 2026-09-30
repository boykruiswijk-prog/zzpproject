# Plan: betrouwbare Exact-status op Integraties

## Bevinding
- De kaart toont `updated_at` als tokenrefresh, maar die waarde staat nog op 23 april; `refresh_token_obtained_at` bevat de echte refresh van 30 september om 13:03.
- De badge beoordeelt het kortlevende access token en geeft daardoor ten onrechte “Token verlopen”.
- De dagtellingen lezen nu `bav_aanmeldingen` vanaf de lokale browsermiddernacht, niet `exact_sync_log` volgens de Amsterdamse kalenderdag. Daardoor wordt de geslaagde keepalive van vandaag 05:17 niet meegeteld.
- Vandaag bevat `exact_sync_log` één regel: keepalive, status `success`, 05:17 Amsterdamse tijd.

## Uitvoering
1. Lees voor de statuskaart `refresh_token_obtained_at`, `last_error` en de laatste geslaagde keepalive uit het log.
2. Bepaal de badge uitsluitend op echte gezondheid:
   - groen “Koppeling werkt” bij geen fout en een geslaagde keepalive jonger dan 26 uur;
   - oranje “Controle ouder dan 26 uur” wanneer die controle ontbreekt of ouder is;
   - rood “Koppeling werkt niet” zodra `last_error` gevuld is, met de foutmelding zichtbaar.
3. Toon de echte laatste tokenrefresh, “Opnieuw koppelen vóór” op refreshdatum + 30 dagen, en “Laatste controle” op de laatste geslaagde keepalive.
4. Tel geslaagde en mislukte regels rechtstreeks uit `exact_sync_log` binnen de huidige kalenderdag van Europe/Amsterdam, inclusief keepalive.
5. Voeg een database-trigger toe die `exact_config.updated_at` bij iedere update op `now()` zet; de kaart gebruikt dit veld niet meer als tokeninformatie.
6. Voeg gerichte tests toe voor de drie gezondheidsstatussen, de 26-uursgrens, de herkoppeldatum en Amsterdamse daggrenzen.
7. Controleer typecheck, tests, preview en actuele read-only waarden. Geen Exact-schrijfacties, mails of publicatie.

## Technische details
- De kaart blijft alleen voor admin/supervisor toegankelijk en gebruikt de bestaande beveiligde leesrechten.
- De Amsterdamse daggrenzen worden als UTC-tijdstippen aan het logfilter doorgegeven, zodat zomer- en wintertijd correct blijven.
- De migratie wijzigt alleen triggergedrag; er worden geen rijen verwijderd of Exact-gegevens aangepast.
