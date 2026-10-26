# E8, cyber toevoegen via Aanvragen

## Uitvoering
Later cyber uit Mijn ZP/team komt via cyber_aanvragen_werkvoorraad in dezelfde aanvraagtabel en mobiele lijst, met label, klant, BAV-nummer, ingang, betaalwijze en notitie. Vandaag te doen en menu gebruiken dezelfde open werkvoorraad. Afgewezen of bevestiging verzonden sluit de werkvoorraad; Alle bewaart historie. Geen nieuwe leads, geen verandering aan dashboard_tellers/scherm_data, geen doel- of instroomtoevoeging. Sluitcontrole weigert cyber_toevoegen in de doelopbouw.

De coordinator heeft afzonderlijke beoordelen/activeren/certificaat/versturen-acties. Beoordelen en activeren nemen geen mailclaims en versturen niets. De aparte cybergenerator legt PDF vast zonder BAV-pdf_url te wijzigen. Ellen bekijkt de opgeslagen PDF; RPC bewaart haar controle voor exact dat pad. Server verzenden vereist Ellen+aal2 en actuele controle. Bestaande certificaatmailclaim vóór bevestigingsclaim, idempotentie en onzekere-verzendingblokkade blijven behouden. Oude clientcall zonder actie beoordeelt alleen: kan niet onbedoeld automatisch mailen.

## Pieter
Read-only op 26 oktober: d6a43c5f geactiveerd 12:58:58.619833 UTC, contract aanwezig, certificaat_mail_status=verzonden en mail_status=verzonden. Statuskolom blijft akkoord_wacht_op_activatie maar de werkstap gebruikt de feitelijke activatie/verzendvelden. Onder Alle zichtbaar, niet opnieuw openen, goedkeuren of mailen. Geen klantrecord gewijzigd.

## Controles
136 Vitest-tests groen, inclusief echte coordinator met gemockte diensten (nul verzending bij beoordeling/activatie), SQL PDF-controle/Ellenrechten, doel-/instroomongewijzigd, vaste akkoordtekst, droge mailvolgorde en activatie. 7 Deno-tests groen (jaar/maand, éénpagina-PDF, lange PDF zonder throw). Deno check van beide gewijzigde functies en automatische build groen. Deployment bevestigd; live OPTIONS 200 en sessieloze POST 401 op beide functies.

## Niet geverifieerd
Echte aangemelde localhostpagina verwijst naar admin/login?stap=instellen met Fout bij instellen 2FA. Geen geldige aal2 beschikbaar; geen factor gewijzigd, geen auth omzeild. Volledige hosted is_test-keten niet uitgevoerd; de lokale handler/SQL/PDF-testketen is geen vervanging hiervoor. Websitepublicatie aangevraagd; admin/aanvragen HTTP 200, nieuwe productiechunk nog niet bevestigd. Geen claim dat die eindcontrole voltooid is.

Ellen-melding 2dbcf4bc-18f6-45a2-af73-68ebd8b922b8 toegevoegd. Geen klantmails, Exact-writes of verwijderingen door deze uitvoering.