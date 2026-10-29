# Live-scherm A24, 29 oktober 2026

De eerste stap is volgens Boy gepubliceerd. Het vervolg hieronder is niet gepubliceerd. Alleen schermweergave aangepast, geen tellerbron, gegevens, route, mails, facturatie of serverfunctie gewijzigd.

## Wijzigingen
- Carrousel 6000 ms; inkomende animatie 0,6 s.
- Vast 1920×1080-beeld, gecentreerde schaal min(breedte/1920, hoogte/1080), achtergrondranden en resize-listener.
- Schermmaten in canvaspixels, kleine teksten minimaal circa 17 px.
- Doelsamenvatting kan afbreken; artikeltitels breken af; Vandaag compact met alle 11 werkminutenregels zichtbaar.
- MachineScene DPR 1 boven 2560 px, anders [1,1.5], bestaande kwaliteitsfallback behouden. StroomScene is SVG, geen DPR-instelling.
- Three meet niet-getransformeerde afmetingen via offsetSize.

## Controle
58 gerichte tests geslaagd; automatische bouwcontrole OK.
Echte scherm-data gelezen via de bestaande schermtoken-toegang in een lokale browser, geen koppeling of datawijziging. /tv bleef /tv.
18 screenshots: panelen Doel, Zichtbaarheid, Vandaag op 1920×1080, 3840×2160, 1366×768, 1920×1200, 1280×720 en 1216×684 (5% kleinere beschikbare viewport). Geen tekst buiten deze panelen; geen gemeten canvastekst kleiner dan 17 px. Alle negen rechterpanelen aanvullend op Full HD bekeken.
Screenshots en meetresultaten: /tmp/browser/tv-a24/.

## Beperkingen
Browser meldt nog de bestaande CSP/WebAssembly-beperking en een niet-beschikbaar agent.glb-bestand in de lokale assetproxy; het kantoor toont daardoor geen figuren. De rest van de 3D-scène, vaste labels en rechterpanelen renderen. Werkelijke tv-hardware-overscan die buiten de browserviewport valt is niet meetbaar met innerWidth/innerHeight; getest is een kleinere beschikbare viewport, geen fysieke tv.

## A24 vervolg: workers en scènelabels
- Alle 23 workers staan volledig in vijf kolommen. Namen, ritme, groep, laatste uitvoering en beschikbare dag/weekaantallen blijven zichtbaar, zonder weglaten of ellipsis. Kleinste tekst 17,28 canvaspixels. Het vaste workersgebied is 470 canvaspixels hoog.
- Alle 11 stations plus Het brein staan in een vast DOM-rooster van zes kolommen en twee rijen binnen het scènegebied. De labels bewegen niet met de camera, behouden dezelfde gegevens/statussen en mogen afbreken. De 3D-geometrie, camera-, activiteit- en scène-logica zijn ongewijzigd.
- Negen nieuwe screenshots met echte scherm-data: Doel, Zichtbaarheid en Vandaag op 1920×1080, 3840×2160 en 1366×768. Op ieder formaat 23 workers, 11 stations plus Het brein; nul worker-overflow, nul label-overflow, nul overlappende labelparen en nul horizontale tekst-overflow. Screenshots visueel gecontroleerd; /tv blijft /tv.
- 59 gerichte schermtests geslaagd, inclusief een regressietest die alle 23 vaste workers bewaakt. Automatische bouwcontrole OK.
- Screenshots en metingen: /tmp/browser/tv-a24-vervolg/. Bestaande figurenbeperking hierboven behouden, niet opgelost of omzeild.
- Vervolg niet gepubliceerd; geen extra Ellen-melding en geen mails/datawijzigingen.

## Ellen
Precies één melding toegevoegd: 9ad8a7d4-7685-446d-ab12-981905ad0af3, onderdeel website, wat_moet_ellen_doen null, omschrijving letterlijk volgens Boy.

## Bestanden
src/pages/Scherm.tsx; src/index.css; src/components/scherm/MachineScene.tsx; src/components/scherm/BreakingMoment.tsx; src/components/scherm/schermWeergave.ts; src/test/schermWeergave.test.ts; src/test/schermPermanent.test.tsx; AGENTS.md; roadmap.md; dit verslag.