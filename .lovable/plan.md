# Favicon-onderzoek zpzaken.nl (16-10-2026, 07:47 UTC), alleen gelezen

## 1. Live bestanden (allemaal ZP Zaken-hexagon, rood met witte "ZP")
- /favicon.ico en /favicon.ico?v=20261015: 200, echte ICO met 3 frames (16/32/48), byte-gelijk aan het projectbestand. ZP-hexagon.
- /favicon.svg: 200, image/svg+xml; ingesloten PNG is byte-gelijk aan favicon-512x512.png. ZP-hexagon.
- /favicon-48x48.png, -96x96, -192x192, -512x512: 200, juiste maten, byte-gelijk aan het project. ZP-hexagon.
- /apple-touch-icon.png: 200, 180x180, witte achtergrond. ZP-hexagon.
- /logo.png: 200, 150x168. ZP-hexagon.
- /og/zpzaken-og-2026.jpg: 200, 1200x630, ZP-ontwerp met ZP-hexagon, geen Lovable.
- /site.webmanifest en /manifest.json: 200, identiek, verwijzen naar 192/512/48 ZP-iconen.
- https://www.zpzaken.nl/favicon.ico: 301 naar https://zpzaken.nl/favicon.ico, eind 200 ZP-icoon.
- http://zpzaken.nl/favicon.ico: 301 naar https://zpzaken.nl/favicon.ico, eind 200 ZP-icoon.

## 2. Wat Google nu serveert
- google.com/s2/favicons?domain=zpzaken.nl&sz=64: doorverwijzing naar gstatic, 64x64 PNG: ZP-hexagon.
- t2.gstatic.com/faviconV2 ...url=https://zpzaken.nl: 64x64 PNG: ZP-hexagon.
Google's eigen faviconservice heeft het nieuwe icoon dus al.

## 3. Headers /favicon.ico
- content-type: image/vnd.microsoft.icon
- cf-cache-status: BYPASS (Cloudflare bewaart geen oude kopie, levert rechtstreeks van de hosting)
- geen age-header; etag 44728d70...
- Opvallend: geen Cache-Control-header. De regels uit public/_headers (max-age=86400) worden door de hosting niet toegepast. Onschuldig voor dit probleem, wel goed om te weten.

## 4. Verwijzingen naar Lovable of oude iconen
- Live HTML-head: precies de zeven versiegebonden ZP-icoonlinks; "lovable" komt alleen voor in de beveiligingsregels (CSP) en de frame-beveiliging, niet als afbeelding.
- public/: geen Lovable-afbeeldingen; oude bijbestanden favicon.jpg en favicon.webp staan er nog maar worden nergens gelinkt.
- Organization-JSON-LD: logo = https://zpzaken.nl/logo.png (ZP-hexagon).

## Conclusie
Niet onze site en niet Cloudflare: elk bestand, elke doorverwijzing en zelfs Google's faviconservice leveren nu het ZP-hexagon. Wat Boy ziet is de oude kopie in Google's zoekresultaten (die indexcache ververst los van de faviconservice, meestal binnen enkele dagen tot weken) of in zijn eigen browsercache. Versnellen kan via Search Console: "URL-inspectie" op https://zpzaken.nl/ en "Indexering aanvragen". Er is geen codewijziging nodig.
