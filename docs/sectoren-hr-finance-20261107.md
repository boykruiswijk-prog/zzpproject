# Register D-aanvulling Sectorlijst: HR en Finance

## Wijziging
- Twee eigen sectoren `hr` / HR en `finance` / Finance, direct onder Management consultancy.
- Aanvraag, offerte, certificaatkeuze en Zeker gebruiken de gedeelde sectorlijst. HR- en Finance-beroepspagina's selecteren het passende eigen label.
- Beide labels worden via de bestaande gedeelde mapping administratief Management consultancy. Het eigen label blijft in aanvraaggegevens behouden.
- Bestaande administratieve waarde `HR & Finance consultancy` blijft staan. Dit is geen sectorkeuze en wordt niet gewijzigd of opnieuw toegewezen.

## Doorwerking
- Verzekeringskaart, polisvoorwaarden en brochure delen dezelfde documentbranche en MCPH-2013B als Management consultancy.
- Premiecalculator gebruikt alleen pakket en starterstatus, niet sector. Alle acht reguliere/starter/maand/jaar/cyber-combinaties getest.
- Geen extra sector-markering voor handmatige acceptatie. Bestaande beroeps- en cybervragen blijven gelden, inclusief afwijzende antwoorden.
- process-bav-wizard valideert het sectorlabel via de gedeelde mapping; branche is Management consultancy, sector blijft HR of Finance.
- Exact-activering vereist en gebruikt de administratieve branche; geen nieuwe boekhoudcategorie of tarief.
- Certificaten gebruiken branche als hoedanigheid, dus Management consultancy. Bij klanten zonder lead gebruikt generate-certificate dezelfde mapping en bewaart sector afzonderlijk.
- Team-/leadweergave toont het eigen sectorlabel apart van administratieve branche. Offertemails houden dezelfde bestaande afsluitlink als Management consultancy.
- Beheer heeft geen aparte vaste sectorfilter-/rapportagetaxonomie; administratieve branchekeuze is een andere lijst en blijft behouden. Dashboard bevat geen aparte Management-consultancy-sectorregel.
- Read-only controle van publieke databasefuncties vond geen Management-consultancy-specifieke functies; constraints bevatten geen sector-/branchebeperking. Geen migratie nodig.
- Geen afzonderlijke externe Hiscox-sectorcodeaanroep gevonden; gedeelde document- en branchegegevens blijven identiek.

## Controles en grenzen
- Gerichte tests: 61 geslaagd.
- Volledige suite: 2642 geslaagd, 1 overgeslagen (238 bestanden).
- Automatische codecontrole: build OK. Afzonderlijke handmatige typecheck/productiebuild niet uitgevoerd, omdat deze omgeving automatische controles voorschrijft.
- Echte offertepagina `/offerte?sector=hr` gecontroleerd: bestaande lege preview, dus visuele end-to-end-keuze niet bevestigd. Geen bestaande previewbug of beveiliging gewijzigd.
- Geen echte aanvragen gemaakt, bestaande aanvragen gewijzigd, Exact-aanroepen of klantmails uitgevoerd.
- Alleen process-bav-wizard, generate-certificate en zeker-chat uitgerold voor de gewijzigde gedeelde mapping/kennis; geen websitepublicatie.
- Precies één Ellen-melding: `df5d8c0a-a0aa-43c9-91c7-a22fe0fe3ab9`, onderdeel website, actie null, teruggelezen.

## Gewijzigde bestanden
- src/data/sectorVerzekeringskaart.ts
- supabase/functions/_shared/sectorBranche.ts
- supabase/functions/_shared/zekerKennis.generated.ts
- supabase/functions/_shared/AGENTS.md
- src/pages/ZzpVerzekeringHR.tsx
- src/pages/ZzpVerzekeringFinance.tsx
- src/test/sectorHrFinance.test.ts
- src/test/sectorBranche.test.ts
- src/test/offerteSectoren.test.ts
- roadmap.md
- docs/sectoren-hr-finance-20261107.md