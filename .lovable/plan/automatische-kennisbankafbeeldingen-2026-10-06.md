# Automatische kennisbankafbeeldingen

## Resultaat
- Artikelen zonder `image_url` krijgen bij elke build een eigen PNG van 1200 × 630, volgens het exact opgegeven ontwerp. Bestaande afbeeldingen en artikelgegevens blijven ongewijzigd.
- Dezelfde afbeelding verschijnt op de artikelpagina, in alle artikeloverzichten en in de sociale metadata en JSON-LD. Gegenereerde sociale afbeeldingen krijgen een absolute URL en de juiste afmetingen.
- Ook conceptartikelen krijgen alvast een afbeelding, zonder hun artikelpagina te publiceren.
- Geen publicatie door Lovable.

## Technische uitvoering
- Een aparte generator met Satori, statische Plus Jakarta Sans 700/800 en Resvg draait vóór het renderen van de artikelpagina’s en schrijft naar `dist/images/kennisbank/`.
- Conceptmetadata wordt uitsluitend tijdens de build gelezen via de bestaande beveiligde databaseverbinding. Geen nieuwe openbare toegang tot conceptartikelen. De verbinding blijft buiten frontendcode en logging.
- Eén gedeelde afbeeldingshelper houdt frontend, prerender en schema gelijk. Statische PNG-bestanden krijgen voorrang op de SPA-fallback.
- Documenteer de buildregel in `AGENTS.md`.

## Controle
- Controleer de automatische build en de twee gevraagde PNG-bestanden, inclusief formaat en visuele inspectie.
- Test afkappen op maximaal drie regels, behoud van bestaande afbeeldingen, sociale metadata en statische bestandsafhandeling.