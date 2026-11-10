# Contentmachine F8, 10 november 2026

## Resultaat
- /beroepsaansprakelijkheidsverzekering: overstapsectie direct onder het ongewijzigde Waar let je op-blok; knoppen naar /verzekeringen#combinatiepolis en /contact; tien FAQ’s in de gevraagde volgorde, dubbele prijsvraag samengevoegd, overige antwoorden behouden; bijwerkdatum.
- /verzekeringen: nieuwe intro, definitielijst met cijfers, vijf FAQ’s en bijwerkdatum vóór Lees meer.
- Nederlandse gedeelde verzekeringskaart: subkop, beschrijving en twee bullets vervangen. Exclusief-bullet was al afwezig. Pakketlabel alleen van Optimale dekking naar Met cyber veranderd; geen bedragen gewijzigd.
- De expliciet aangeleverde woorden financieel adviseurs en bemiddelaars in de verplichtings-FAQ zijn behouden als verwijzingen naar derden, niet als zelfbeschrijving van ZP Zaken.

## Controles
- Gerichte tests: 32 geslaagd.
- Eerste volledige suite: één bestaande broncode-plaatsingscontrole verwachtte het oude JSX-patroon. Controle aangepast aan de extra opt-in sectie; het oorspronkelijke Waar let je op-blok blijft intact.
- Definitieve volledige suite: 243 bestanden, 2668 tests geslaagd, 1 overgeslagen, 0 fouten.
- FAQ-pariteit: beide pagina’s gerenderd met bestaande externe paginadelen geïsoleerd; exact één FAQPage per pagina, 10 respectievelijk 5 unieke vragen; ieder uitgeklapt antwoord exact gelijk aan schema. Losse Lees meer-links staan buiten antwoordtekst.
- Zeker-kennis byte-pariteit en tekstnormtests geslaagd. Geen regeneratie vereist.
- Automatische bouwcontrole: build OK (06:24:30 UTC). Een afzonderlijke typecheck en productiebuild zijn niet aantoonbaar uit de beschikbare logs; niet handmatig gestart vanwege de platforminstructie.
- Echte previewcontrole: beide URL’s openen met een bestaande lege pagina (geen H1 of schema). Visuele eindcontrole daarom niet bevestigd; geen buiten-scope herstel gedaan.

## Ellen en publicatie
Eén website-melding a5777ae1-d0b9-42fd-bd86-087e824974c5 toegevoegd en teruggelezen, actie null. Niet gepubliceerd. Geen klantmail, financiële of aanvraaglogica gewijzigd.

## Bestanden
- src/pages/Beroepsaansprakelijkheidsverzekering.tsx
- src/pages/Verzekeringen.tsx
- src/components/diensten/BeroepVerzekeringPagina.tsx
- src/i18n/locales/nl.json
- src/data/bavPakketten.ts (uitsluitend label)
- src/test/contentmachineF8.test.tsx
- src/test/waarLetJeOpBav.test.ts
- roadmap.md
- docs/contentmachine-f8-20261110.md

Commits worden automatisch door het platform vastgelegd; geen handmatige Git-mutaties uitgevoerd.
