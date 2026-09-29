# Plan: facturatie H13, H14, M1, M2 en M3

## Doel
Factuurteksten worden kort en uniform, factuurreferenties worden herkenbaar, maandelijkse instapfacturen worden idempotent geregistreerd, onterechte creditnota’s worden voorkomen en de maandpolis-preview toont geen restitutie.

## Uitvoering
1. **Gedeelde factuurtekst**
   - Maak `_shared/factuurTekst.ts` als pure helper zonder imports.
   - Bouw daar alle regelomschrijvingen, notities, kopteksten en referentiekeuze op.
   - Gebruik `dd-mm-jj`, periode vooraan en maximaal 60 tekens.
   - Pas activatie/herproberen, polisacties, maandcron en de factuurperiodetest hierop aan.

2. **Herkenbare factuurreferentie**
   - Voeg `leads.exact_relatie_code` als optionele tekstkolom toe.
   - Lees bij activatie de Exact-relatiecode mee of haal hem alleen-lezen op, trim hem en sla hem voortaan op.
   - Kies overal eerst het polisnummer en anders de opgeslagen relatiecode; nooit meer het lead-ID.
   - Bestaande leads worden niet teruggevuld vanuit Exact.

3. **Maandpolis-idempotentie**
   - Registreer een geslaagde instapfactuur bij zowel normale activatie als `retry_invoice` in `monthly_invoices_log`, met werkelijk pro-ratabedrag.
   - Behoud de bestaande unieke sleutel `(lead_id, factuur_jaar, factuur_maand)` als harde dubbele-factuurbeveiliging.
   - Voeg een pure beslisfunctie/test toe die bewijst dat de cron een reeds succesvol geregistreerde maand overslaat.

4. **Creditnota alleen na geslaagde factuur**
   - Controleer vóór een jaarpolis-creditnota `exact_sync_log` op een geslaagde `invoice_create`, `invoice_retry` of `factuur_hervat` voor dezelfde lead.
   - Zonder zo’n bewijs: geen Exact-aanroep, wel logregel `creditnota_overgeslagen_geen_factuur`; pauzeren of opzeggen gaat gewoon door.

5. **Maandpolis-preview**
   - Laat de preview voor pauzeren/opzeggen bij een maandpolis €0 retourneren met de vastgestelde uitleg.
   - Toon die uitleg in het bestaande portaalvenster zonder de overige acties te veranderen.

6. **Veilige uitrol en controle**
   - Pas eerst database en broncode aan en deploy de betrokken functies.
   - Controleer daarna met `rg` dat alle factuurpaden de gedeelde helper gebruiken en geen UUID als `YourRef` zetten.
   - Test vervolgens alleen pure/unit- en read-only/dry-runpaden; maak geen Exact-documenten, stuur geen mails en activeer geen lead.
   - Controleer typecheck en actuele buildstatus.

## Technische details
- Nieuwe databasekolom is additief en nullable; er is geen backfill.
- `Notes` bevat de berekening, terwijl `Description` uitsluitend de korte periodegerichte tekst bevat.
- De polisnummerkeuze vraagt per factuurroute een beperkte `policies.certificate_number`-lookup.
- De factuurperiodetest blijft alleen via zijn bestaande verificatiepad bruikbaar; er worden tijdens deze opdracht geen testfacturen of testrelaties aangemaakt.
