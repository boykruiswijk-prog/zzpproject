# Zwevende knoppen en kopbalk herstellen

## Aanpak
- Groepeer de zwevende telefoon- en WhatsApp-acties op desktop met vaste ruimte ertussen, zodat ze elkaar nooit bedekken.
- Houd op mobiel rekening met de vaste actiebalk, cookiemelding en veilige schermrand; zwevende acties mogen formulieren en verzendknoppen niet afdekken.
- Zet de menubadge bij Collectief terug naar `NIEUW`; de langere tekst blijft alleen op de collectiefpagina en waar passend in de uitklapinhoud.
- Houd alle kopbalklabels, het telefoonnummer en knoppen op één regel. Schakel eerder over naar het mobiele menu wanneer 1280 px anders te krap is.
- Werk de regressietest bij zodat de korte menubadge expliciet is toegestaan, terwijl publieke aantallen en voortgang verboden blijven.

## Controle
- Controleer de pagina en geopende menu’s visueel op 390, 1280 en 1440 px; controleer de kopbalk aanvullend programmatisch op 1366 en 1920 px.
- Draai de productiecontrole, alle tests en de typecontrole.
- Niet publiceren en geen wijzigingen aan formulieren of opslag.

## Technisch
- Hergebruik bestaande stijlen en vaste contactonderdelen; voeg geen nieuwe actieknoppen toe.
- Gebruik `env(safe-area-inset-bottom)` voor de mobiele ondermarge en vaste responsive afmetingen om verschuivingen te voorkomen.
