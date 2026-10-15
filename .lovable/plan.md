# Verborgen pensioenpagina met Evi

## Pagina
- Bouw `/pensioen-opbouwen-zzp` als verzorgde ZP Zaken-voorbeeldpagina met alle aangeleverde teksten, eigen SVG, tien FAQ's, schema, bundelplekhouders en contactformulier.
- Maak de twee rekenhulpen lokaal en toegankelijk, zonder opslag, verzending of rendementsaanname.
- Gebruik de expliciet gevraagde Hiscox-vermelding alleen in het BAV-blok, ondanks de algemene beperking op andere aanbieders.

## Verborgen en later publiek
- Eén vlag in `eviPagina.ts`, nu `false`, bepaalt robots, sitemap, beide llms-bestanden, menu, zoekindex, Zeker en het toekomstige linkblok op `/pensioen`.
- Prerender de route wel, met echte tekst en `noindex,nofollow`. Geen taalvarianten of legacy-doorverwijzing.
- Verander de huidige inhoud van `/pensioen` niet. Het nieuwe linkblok verschijnt alleen bij de publieke vlag.

## Formulier en aanvraag
- Hergebruik de beveiligde contactverwerking en bestaande teammelding, zonder nieuwe klantmail of extra tracking.
- Toon intern het label “Pensioen via Evi”.
- De BAV-knoppen openen de bestaande aanvraag met jaarbetaling en `bron=evi-pagina`. Bewaar deze interne bron apart bij aanvraag en concept, zonder advertentieherkomst te wijzigen.

## Technische details
- Kleine onderdelen voor inhoud/schema, formules, rekenhulp, formulier, illustratie en bundelvoorwaarden. Lazy route, bestaande UI-onderdelen en kleuren.
- Fiscale waarden uit de bestaande centrale cijfersbron. Voeg ontbrekende lijfrente- en AOW-waarden met officiële bronvermelding toe, zonder bestaande pensioenwaarden te vervangen.
- Alleen waar nodig een additief conceptveld voor de interne bron en aanpassingen aan de bestaande formulierfuncties. Geen bestaande rijen wijzigen of verwijderen.

## Controle en oplevering
- Test verborgen en publieke vlagtakken, robots/prerender, teksten/schema, bronbehoud en beide formules.
- Draai de volledige bestaande testsuite en meld ook eventuele bestaande fouten eerlijk.
- Controleer de pagina en rekenhulpen op desktop en 360px, zonder formulierinzending.
- Lever de bestandenlijst en testaantallen. Geen publicatie, klantmail of wijzigingsmelding.