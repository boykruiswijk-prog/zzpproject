# Oude WordPress-doorverwijzingen 21 oktober

## Wijziging
- Voeg de twee patronen en zes specifieke oude paden toe met de opgegeven directe bestemmingen.
- Behoud alle bestaande doorverwijzingen en CSV-regels. Bescherm bestaande pagina's en `/tv`.
- Voeg dezelfde regels toe aan de bestaande redirectuitvoer en Cloudflare-lijst, inclusief slashvarianten. De patronen krijgen Cloudflare-subpadmatching zonder behoud van het oude pad.
- Controleer de nieuwe paden en draai alle bestaande redirect- en routetests.

## Technische details
- Gebruik `legacyRedirects.ts` als bron en de bestaande generatoren voor uitvoer. Breid alleen waar nodig de CSV-generator uit voor de twee nieuwe patronen.
- Het gecodeerde pakketpad verwijst direct naar `/verzekeringen`, dezelfde bestemming als het bestaande hoofdpad.
- Lovable verwerkt `_redirects` niet als hostingregels; de Cloudflare-lijst moet na controle apart worden geïmporteerd voor echte HTTP-301's, met name de XML-paden.

## Grenzen
Geen publicatie, gegevenswijzigingen, mails of aanpassingen aan prijzen, facturatie, SEPA, formulieren of tracking.
