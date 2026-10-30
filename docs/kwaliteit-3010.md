# Kwaliteitscontrole 30 oktober 2026

Niet gepubliceerd. /aov zelf, prijzen, facturatie, SEPA, Exact, functionele Edge Function-code en klantmails zijn ongemoeid; niets verwijderd. Alleen de expliciet gevraagde gegenereerde Zeker-kennis is als tekst bijgewerkt, niet gedeployed.

## A. FAQ en kennis
- A1 tot A4: `src/data/faqItems.ts`, commit `90c8312f`; /faq en FAQPage-schema gebruiken deze bron zonder paginawijziging.
- A5: `src/config/seoRoutes.ts`, commit `90c8312f`, intro /zo-werken-wij: "antwoord op je vragen".
- Gelijke afgeleide teksten: `public/llms-full.txt` en `supabase/functions/_shared/zekerKennis.generated.ts`, commit `1f381f4d`.
- `public/llms.txt` bevatte de juiste /zo-werken-wij-beschrijving al en is niet gewijzigd.

## B. Artikel
Alleen `public.articles.content`, slug `verplichte-aov-voor-zzp`, id `e0305f39-4128-4f43-aa81-b2f054dc98c7`, met gerichte replace en vooraf gecontroleerde inhoudshash. Geen andere kolommen expliciet gewijzigd.

Vervangen: "maar beschermt je ook bij langdurige uitval" door "maar keert ook uit bij langdurige uitval, volgens de polisvoorwaarden".

Teruggelezen: oude zin ontbreekt; nieuwe zin aanwezig. Inhoudslengte 6715 naar 6741, precies 26 tekens verschil. MD5 vóór `2260e723f446c5e2181bb9f7ddbbc8a4`, na `e5799dcc685d1528104097eaa78b1dda`. Deze rechtstreekse databasewijziging heeft geen Git-commit; dit rapport legt haar vast. Een databaseartikel kan al zichtbaar worden vóór websitepublicatie.

## C. Doorverwijzingen
- `src/config/legacyRedirects.ts`, commit `ebaf8e10`: privacy-statement naar cookies; control/verzekeringen/zorg-en-zekerheid naar zorgverzekering; kopie-van-inschrijven-shift-happens naar /; zzp-verzekering-interim naar zzp-verzekering-interim-manager; home/nieuws/* naar kennisbank; oud Hiscox-ontwikkelpad naar /logos/hiscox.png. Taalprefixen erven ook het nieuwspatroon.
- `scripts/articleRedirects.ts`, commit `ebaf8e10`: rondom slugs slashes normaliseren; geen pad-specifieke artikelfix. Uitvoer blijft twee directe 301-varianten.
- `vite.config.ts`, commits `ebaf8e10`, `b6886ae2`: exacte legacyregels en taalregels krijgen directe slashvarianten; Cloudflare-nieuwspatroon gebruikt subpadmatching zonder suffix en krijgt voorrang bij ontdubbelen.
- `public/_redirects`, `docs/cloudflare-bulk-redirects.csv`, definitieve commit `b1e7715e` (eerste afleiding `1f381f4d`): root-artikelen uit de actuele 63 gepubliceerde artikelen, inclusief het internetkostenvoorbeeld met/zonder slash.
- Hiscox: geen vaste publieke ontwikkel-URL in sitecode, SEO/schema, llms, artikelteksten of opgeslagen klantmailteksten gevonden. Drie gewone Vite-imports blijven behouden. De interne foto-inventaris heeft een `site-asset:`-identifier, geen publieke URL; niet gewijzigd. Gepubliceerd /logos/hiscox.png gecontroleerd: HTTP 200 image/png. De 301 vangt oude externe verwijzingen op.
- /tv en /tv-subpaden krijgen geen legacybron of Cloudflare-rij.

## D. Tests en preview
- `src/test/kwaliteit3010.test.ts`, commit `79bda22d`: verboden formuleringen, brongelijkheid, alle C-doelen/taalprefixen, nieuwspatroon, structurele slashnormalisatie, bestaand legacyartikel, /tv-behoud en PNG-doel.
- `src/test/kwaliteit2310.test.ts`, commit `b6886ae2`: verouderde aanname "geen afgeleide wildcards" beperkt tot de expliciet toegestane drie home/nieuws-taalpatronen; overige checks behouden.
- 171/171 tests geslaagd: alle kwaliteit*-tests, Zeker, articleRootRedirects, redirects21Oktober, redirectsA16 en redirectRouteConflict.
- Automatische bouwcontrole: build OK.
- Preview /faq: nieuw antwoord zichtbaar en exact gelijk aan FAQPage-JSON-LD; zes doorverwijzingen inclusief /de/home/nieuws/page/6/ gecontroleerd; nul paginafouten. Screenshot `/tmp/browser/kwaliteit3010/faq.png`.
- Hosting-301's zijn als uitvoer getest; live HTTP-301's worden pas na publicatie en eventuele Cloudflare-import actief. Niet gepubliceerd of functies gedeployed.