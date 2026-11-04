# Cybervoorwaarden online: controle Boy 4 november

**Klaar voor controle, niet gepubliceerd.** Beide officiële PDF's zijn gedownload van de opgegeven Hiscox-adressen en ongewijzigd als eigen statische bestanden geplaatst.

## Bestandsbewijs

| Bestand in public/voorwaarden | Bytes | SHA-256 |
|---|---:|---|
| verzekeringskaart-cyberclear-hiscox-2022.pdf | 219293 | 157c79b423b71469c33cc96512938319af6dcbdc463e185d57b5bea44a29932f |
| polisvoorwaarden-cyberclear-hiscox-hcc-2022-01.pdf | 1347269 | 198789f50489780c8b71bea43c4ebaf7e2bd03c4f658d4a1270a04ac2a0cdf56 |

Beide zijn exact gelijk aan de aangeleverde versies. De eigen preview-URL's geven HTTP 200 en dezelfde bytes/hashes. Geen hotlinks naar Hiscox.

## Per plek

| Plek | Wijziging |
|---|---|
| /voorwaarden | Onder bestaande BAV-documenten: **Cyberverzekering (CyberClear by Hiscox)**, versie **HCC-2022/01**, beide PDF-links en exact **Cyber sluit je alleen af samen met de BAV + AVB.** Geen bedragen of interne limiettekst toegevoegd. |
| Homepage, pakketkaarten | Oude telefoon-/contactverwijzing vervangen door klikbare verwijzing naar /voorwaarden#cyber; dezelfde bestemming bij de voorwaardenregel in cyberpakketten. |
| /faq, vraag Wat dekt cyber? | Alleen de laatste opvraagzin vervangen: **De cybervoorwaarden vind je op zpzaken.nl/voorwaarden#cyber.** Het adres is klikbaar; zichtbaar antwoord en FAQ-schema volgen dezelfde bron. |
| /starters, cybervraag | Dezelfde vervanging en link; prijzen en overige antwoordtekst ongemoeid. |
| /zzp-verzekering-ict, cybervraag | Dezelfde vervanging en link via bestaande tekstweergave; overige tekst ongemoeid. |
| /bav-zzp-vergelijken, cyberblok | Dezelfde vervanging en link; overige cybertekst/prijzen ongemoeid. |
| BAV-aanvraag, cyberuitleg en samenvatting | Bestaande woord **polisvoorwaarden** klikbaar naar /voorwaarden#cyber. Letterlijke tekst, akkoord, berekeningen en verzending ongewijzigd. |
| Mijn ZP, cyberpolis | Bestaande woord **polisvoorwaarden** klikbaar naar /voorwaarden#cyber. Letterlijke tekst en toegangsregels ongewijzigd. |
| llms.txt en llms-full.txt | Opvraagzin vervangen; apart cyberdocumentenblok met eigen PDF-URL's. Bestaande kennisbankartikelen behouden; AOV-vermelding behouden. |
| Zeker-kennisbron | Gedeelde opvraagzin vervangen, beide documenten toegevoegd; gegenereerde bron bijgewerkt. Geen functie-uitrol, zodat dit niet voortijdig live gaat. |
| SEO /voorwaarden | Titel en omschrijving noemen BAV, AVB en cyber; versie HCC-2022/01. Canonical blijft dezelfde. |
| Sitemap/prerender | /voorwaarden bestond al in beide. Lastmod van deze pagina naar 4-11; geen nieuwe route, fragment-URL of redirect toegevoegd. De bestaande prerender rendert het nieuwe blok bij publicatie. |

**Bewust niet aangepast:** cybercertificaat- en mailteksten, serverakkoord/consent, opgeslagen bewijs, prijzen, de tekst over akkoord geven in de /bav-zzp-FAQ, en /tv. De verzoektekst in het certificaat valt buiten deze website-opdracht.

## Controles

- Desktop 1280px en mobiel 390px: blok en beide documenten zichtbaar zonder horizontale overloop.
- Echte flow: /faq openen, Wat dekt cyber? openklappen, voorwaardenlink klikken, eindadres /voorwaarden#cyber met zichtbaar blok.
- Beide eigen PDF's via preview HTTP 200, bytes en SHA-256 exact.
- 4 gerichte controles groen; volledige suite **2058 geslaagd, 1 bestaande overgeslagen**.
- Automatische build **OK**. Geen handmatige build/typecheck gestart.
- Eén website-melding aan Ellen, met de vermelding dat Boy nog publiceert. Geen klantmail, geen publicatie.

## Gewijzigde bestanden

- Twee PDF's in `public/voorwaarden/`
- `src/data/cyberDocumenten.ts`, `src/config/cyberPubliek.ts`
- `src/components/shared/CyberVoorwaardenTekst.tsx`
- `src/pages/Voorwaarden.tsx`, `src/pages/FAQ.tsx`, `src/pages/Starters.tsx`, `src/pages/BavZzpVergelijken.tsx`
- `src/components/home/CombiPackageSection.tsx`, `src/components/home/BAVApplicationModule.tsx`
- `src/components/diensten/BeroepspaginaTekst.tsx`, `src/components/portal/CyberPolis.tsx`
- `src/config/seoRoutes.ts`, `src/config/sitemapLastmod.json`, `public/sitemap.xml`
- `scripts/llmsTxt.ts`, `public/llms.txt`, `public/llms-full.txt`
- `src/lib/zeker/bouwKennis.ts`, `supabase/functions/_shared/zekerKennis.generated.ts`
- `src/test/cyberVoorwaardenOnline.test.ts`, `AGENTS.md`, `roadmap.md`, dit rapport