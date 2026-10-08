# Plan: interne cyberjaarlimiet uit publieke kanalen verwijderen

## Wijzigingen

- Splits de gedeelde cybertekst in een publieke bron en een interne beheerbron.
- Publiek blijft uitsluitend zichtbaar: dekking per schade met beide eigen risico's, 72-uurshulp, prijs, looptijd en de verwijzing naar de polisvoorwaarden.
- Verwijder de gedeelde jaarlimiet uit websitepagina's, aanvraag, Mijn ZP, FAQ, structured data, bevestigingsteksten, `llms.txt` en de kennis van Zeker.
- Laat de interne jaarlimiet beschikbaar in afgeschermd beheer/CRM, zonder de openbare pakketgegevens of chatbotkennis ermee te voeden.
- Laat AVB €2.500.000 per aanspraak volledig intact.

## Controle

- Genereer de afgeleide Zeker-kennis en `llms.txt` opnieuw.
- Zoek in de volledige code en publieke content naar `gedeelde limiet`, cyber-gerelateerde `€2.500.000` en varianten.
- Controleer databasecontent read-only op dezelfde publieke vermeldingen.
- Draai de relevante tests en controleer de previewbuild.
- Geen publicatie, klantmail, Exact-mutatie of verwijdering.

## Technisch

- De interne limiet blijft een afzonderlijke constante voor medewerkers; publieke onderdelen importeren die niet.
- De zichtbare standaardzin wordt exact: `Cyber tot €50.000 per schade, eigen risico €500 (cyberfraude €1.000)`.
- Publieke detailtekst verwijst alleen naar de polisvoorwaarden en bevat geen collectieve jaarlimiet.