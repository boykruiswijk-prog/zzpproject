# Plan: Starterspakket BAV + AVB

Starters (KVK-inschrijving jonger dan 12 maanden op de ingangsdatum) betalen de eerste 12 maanden EUR 45 per maand of EUR 495 per jaar. Daarna gaan ze automatisch naar EUR 55 per maand of EUR 600 per jaar. Polis, dekking en voorwaarden zijn gelijk aan de gewone BAV + AVB. Bestaande klanten en contracten blijven zoals ze zijn.

## 1. Waar de prijzen nu staan (gecontroleerd)

- **Website:** `src/data/bavPakketten.ts` (55 per maand, 600 per jaar, 750 per jaar, `VANAF_PRIJS_LABEL`). Hiervan lezen `BAVApplicationModule.tsx`, `CombiPackageSection.tsx`, `StickyMobileCTA.tsx`, `Verzekeringen.tsx`, `WaaromZpZaken.tsx`, `BavZzpVergelijken.tsx`/`bavVergelijking.ts`, `BeroepVerzekeringPagina.tsx`, `ServicePageTemplate.tsx`, `ZzpVerzekeringICT.tsx`, `schema.ts`/`SiteSchemaMarkup.tsx` (OfferCatalog), `tracking.ts` (waarde van de purchase-meting), `seoRoutes.ts` en de Zeker-kennis (`bouwKennis.ts` → `_shared/zekerKennis.generated.ts`).
- **Functies op de server:** `process-bav-wizard/index.ts` heeft een eigen prijslijst (55/600) en zet `maandpremie`/`jaarpremie`/`premiebedrag` in `bav_aanmeldingen`. `_shared/offerte.ts` gebruikt `bavPakketten`. `lead-to-exact-activate` maakt het Exact-abonnement aan.
- **Database:** `bav_aanmeldingen` (premievelden per aanvraag). `klant_contracten.bedrag_per_periode`, `org_prijs` en `afw_prijs` per contractregel. `factuur_planning.bedrag_per_periode`/`bedrag` (vastgelegd bij claim). `factuur_artikel_mapping` bevat geen bedragen, alleen artikel, grootboek en btw.
- **Facturatie:** `facturatie_kandidaten()` neemt het bedrag uit `klant_contracten.bedrag_per_periode`. `factuur-planner` zet dat bedrag in Exact-concepten. `doorrol_startstand` en de opzeg-credits (`plan_opzeg_credit`, `_shared/creditOpzegging.ts`) gebruiken dezelfde bedragen.

## 2. KVK-inschrijvingsdatum (gecontroleerd: nu niet beschikbaar)

We halen nu geen KVK-gegevens op. Er is geen KVK-API-koppeling en we slaan geen registratiedatum op. `exact-account-lookup` zoekt alleen in Exact op KvK-nummer.

Mijn voorstel:
- **Automatisch:** een nieuwe server-functie `kvk-basisprofiel` vraagt de KVK Basisprofiel API op (registratiedatum / datum aanvang, alleen lezen, met rate limit). Hiervoor is een betaald KVK API-abonnement nodig. De sleutel `KVK_API_KEY` vul je zelf in bij de Secrets.
- **In het formulier:** stap 1 vraagt "Startdatum inschrijving KVK", zodat de klant zelf de datum invult. Ook als de opzoeking werkt, slaan we deze datum op ter controle.
- **Opslaan:** in `bav_aanmeldingen` en daarna in het contract komen `kvk_registratiedatum`, `kvk_datum_bron` (`kvk_api` / `klant_opgave` / `handmatig`) en `starter_controle_status` (`automatisch_goedgekeurd`, `te_controleren`, `goedgekeurd`, `afgewezen`).
- **Geen bevestiging door KVK** (geen sleutel, API-fout of een datum die afwijkt van de opgave): we geven voorlopig het startertarief op basis van de opgave. Er komt een taak "Startertarief controleren" in Vandaag te doen en in het CRM. Een supervisor of admin keurt dat goed of af via de nieuwe RPC `beoordeel_startertarief` (met audit). Pas daarna zet `lead-to-exact-activate` het abonnement in Exact. Zo komt er nooit een concept met het verkeerde bedrag.

## 3. Startertarief per contract vastleggen

Nieuwe kolommen die bestaande contracten niet raken (allemaal met een standaardwaarde):
- `klant_contracten.tarief_type text default 'standaard'` (`'standaard'|'starter'`), `starter_tot date` (= ingangsdatum + 12 maanden min 1 dag), `bedrag_na_starter numeric`.
- Dezelfde velden in `bav_aanmeldingen`, plus de KVK-velden uit stap 2.

Rekenregel: `facturatie_kandidaten` krijgt per periode het bedrag via de nieuwe pure SQL-functie `contract_bedrag_voor_periode(contract, periode_start)`. Die geeft `bedrag_na_starter` als het een starter is en `periode_start > starter_tot`, en anders `bedrag_per_periode`.
- Maandbetaling: maand 1 t/m 12 kosten 45, vanaf maand 13 kost het 55.
- Jaarbetaling: periode 1 kost 495, periode 2 kost 600, omdat de tweede periode begint na `starter_tot`.
- Een periode die over de grens heen loopt kan niet voorkomen, want `starter_tot` valt precies op een periodegrens. Een database-check dwingt dat af.
- Credits bij opzegging rekenen met het bedrag van de periode die al gefactureerd is (dat staat in `factuur_planning`). Daar verandert dus niets.

Effect op de facturatie vanaf 13 oktober:
- Alle bestaande contracten krijgen `standaard`. Hun uitkomst blijft daardoor bytegelijk.
- De Exact-conceptflow, de planningssleutels (ZPF-) en de schakelaar blijven ongewijzigd. Exact krijgt alleen concepten.
- Exact-abonnement: voor de starter maken we een apart artikel of een prijsafwijking op de abonnementsregel. Welke, beslist Roxy (zie open vragen). De planner factureert op basis van onze database, niet op basis van de Exact-abonnementsprijs.

## 4. Aanvraagflow

- `bavPakketten.ts` krijgt starterprijzen: `starterMaandprijs 45`, `starterJaarprijs 495` en `starterDuurMaanden 12`. Die komen ook byte-gelijk in een gedeelde `_shared/starterTarief.ts`, en `src/lib/starterTarief.ts` spiegelt dat. Daar staat de pure regel `isStarter(kvkDatum, ingangsdatum)`: jonger dan 12 maanden op de ingangsdatum.
- `BAVApplicationModule.tsx`: na het invullen van de KVK-datum verschijnt een blok "Startertarief van toepassing". Daarin staan de prijs, de prijs na 12 maanden en de voorwaarde. Het overzicht aan het eind toont beide prijzen. Zonder starterstatus verandert er niets.
- `process-bav-wizard` rekent het tarief opnieuw op de server uit. Wat de browser stuurt, vertrouwen we niet. Daarna zet de functie de velden. `/aanvragen?pakket=starter-maand` mag het formulier vooraf invullen, maar de server beslist.
- Teammail en leaddetail tonen "Startertarief tot <datum>, daarna EUR 55/600".
- Aanvragen die er al zijn worden niet aangepast.

## 5. Pagina /starters

- `src/pages/Starters.tsx` hergebruikt `ServicePageTemplate`/`BeroepVerzekeringPagina`, dus er komt geen nieuw ontwerp.
- Inhoud: bedenker van de BAV + AVB in één polis, marktleider, 13+ jaar, 5.000+ zzp'ers, verzekerd bij Hiscox. Daarna een prijsblok (45/495 eerste 12 maanden, daarna 55/600, inclusief kosten en assurantiebelasting, voorwaarde KVK-inschrijving jonger dan 12 maanden), een FAQ en een knop naar `/#combinatiepolis?pakket=starter`.
- Controle op teksten: niet "gratis", geen tijdsdruk, niet "goedkoopste", niet "verzekeringsbemiddelaar" en geen em dash. Een test controleert dit automatisch.
- Route in `App.tsx`/`AppRoutes`, `seoRoutes.ts` (sitemap en prerender), het menu onder Diensten, FAQPage en Product/Offer JSON-LD (met beide prijzen en de voorwaarde). Daarnaast een korte vermelding in `llms.txt` en in de Zeker-kennis, met dezelfde AFM-zinnen.

## 6. Bestaande klanten en grenzen

Bestaande klanten en contracten veranderen niet. We sturen geen klantmails, verwijderen niets en doen geen Exact-writes buiten de conceptflow. Testdata markeren we als `is_test` en we gebruiken alleen adressen op @zpzaken.nl.

## 7. Teststrategie (zonder echte facturen)

- Unit-tests voor `isStarter`, met grensgevallen: precies 12 maanden, schrikkeljaar en een ontbrekende datum.
- Unit-tests voor `contract_bedrag_voor_periode`, de wizardberekening en de controle op AFM-teksten.
- SQL in een transactie die we terugdraaien: twee `is_test`-starters (maand en jaar). Daarop draaien we `facturatie_kandidaten` voor maand 1, 12 en 13 en voor jaar 1 en jaar 2. We verwachten 45/45/55 en 495/600. Daarnaast een standaardcontract als controle (55/600), en we checken dat de huidige preview voor 13 t/m 19 oktober gelijk blijft.
- `factuur-planner` draait alleen als proefrun (preview), dus er gaat niets naar Exact.
- Met Playwright testen we de wizard (starter en geen starter), de /starters-pagina en de JSON-LD.

## Stappen

1. Migratie: KVK- en tariefvelden plus de rekenfunctie. `facturatie_kandidaten` gaat het bedrag per periode gebruiken, en er komt de RPC `beoordeel_startertarief`. Daarna de controle dat de preview van 13 t/m 19 oktober ongewijzigd is.
2. De gedeelde starterhelper met de prijzen.
3. `process-bav-wizard` en `lead-to-exact-activate`: starter vastleggen en de controle-blokkade.
4. De wizard-UI en het overzicht.
5. Een CRM/Vandaag-taak "Startertarief controleren".
6. Optioneel `kvk-basisprofiel`, zodra de sleutel er is.
7. De pagina /starters met SEO, menu en JSON-LD.
8. Tests en een verslag aan jou. Niet publiceren.

## Risico's

- **Wijziging in `facturatie_kandidaten`:** dit raakt de dagrun. Dat beperken we met de standaardwaarde en een vergelijking van de preview vóór en na.
- **Exact-abonnementsprijs wijkt af van onze database:** Roxy moet kiezen hoe we de starter in Exact vastleggen.
- **Valse opgave van de KVK-datum:** daarom komt er een supervisorcontrole vóór de activering.
- **Kosten en beschikbaarheid van de KVK API:** zonder sleutel is controle met de hand nodig.
- **Prijzen op veel plekken:** alles moet uit `bavPakketten`/`_shared` komen. Een grep-test controleert dat er niets hardcoded staat.

## Open vragen (aannames tussen haakjes)

- Neem je een KVK API-abonnement? (aanname: eerst controle met de hand, de API later)
- Hoe leggen we de starter in Exact vast: apart artikel of prijsafwijking? (aanname: apart artikel, op te zetten door Roxy)
- Telt de datum van inschrijving bij KVK, of de datum aanvang onderneming als die eerder ligt? (aanname: de vroegste van de twee)
