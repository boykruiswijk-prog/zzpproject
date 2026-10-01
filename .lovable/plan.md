# Plan: het CRM stuurt Exact aan

## Bevindingen bij punt 5: hoe nieuwe klanten nu worden gefactureerd
- **`lead-to-exact-activate`** maakt in Exact een relatie (Account), contactpersoon, bankrekening en SEPA-mandaat aan. Daarna maakt hij direct één losse verkoopfactuur (`salesinvoice/SalesInvoices`, concept): de eerste periode, bij een maandpolis pro rata. Hij maakt **geen Exact-abonnement** aan.
- **`exact_subscription_mapping`** bevat 3 regels, maar wordt alleen in het scherm Integraties getoond. Geen enkele functie gebruikt hem. Het veld `leads.exact_abonnement_id` is bij 0 leads gevuld.
- **`monthly-invoices-cron`** maakt elke maand voor actieve maandpolissen (`gekozen_pakket = 'maandelijks'`) een losse factuur van 55 euro. Dubbel factureren binnen de site voorkomt hij via `monthly_invoices_log` (uniek per lead, jaar en maand). De cron staat **uit** (`monthly-invoices-cron-daily`, active = false) en het log is leeg.
- **Jaarpolissen** krijgen alleen de eerste factuur bij activatie. Er is geen functie die het tweede jaar factureert.
- `polis-lifecycle` maakt losse creditnota's en facturen bij pauzeren, hervatten en opzeggen.

Conclusie:
- **Nu wordt een nieuwe klant niet dubbel gefactureerd.** Er is geen abonnement en de cron staat uit.
- **Maar na de eerste factuur wordt hij helemaal niet meer gefactureerd.** Maandklanten krijgen vanaf maand 2 niets, jaarklanten vanaf jaar 2 niets. Dit geldt nu voor 0 echte actieve leads; alle actieve leads zijn test.
- **Risico op dubbele facturatie ontstaat zodra twee dingen tegelijk gebeuren:** iemand zet de cron aan, én Sandra maakt in Exact handmatig een abonnement voor dezelfde klant. Dan factureren cron en abonnement allebei.
- Gecontroleerd in het CRM: de 36 regels waarvan de volgende periode op of vóór 16-10-2026 begint, kloppen met jouw telling. Eén daarvan ligt al vóór oktober (rij 610).

## Fase 1: alleen lezen uit Exact (bouwen na akkoord)

### 1. Relaties koppelen
- Nieuwe functie **`exact-spiegel-sync`**:
  - alleen voor supervisor/admin;
  - gebruikt het bestaande token via `_shared/exactToken.ts` en de geconfigureerde divisie via `_shared/exactDivision.ts`;
  - doet uitsluitend GET-verzoeken naar Exact; er staat geen POST/PUT/DELETE in de code;
  - een test borgt dat er geen schrijfmethode in de functie voorkomt.
- **Relaties ophalen** via `bulk/CRM/Accounts`, met de velden `ID, Code, Name, ChamberOfCommerce, Status, IsSales, Blocked`:
  - de code wordt getrimd;
  - bij een numerieke code wordt ook de waarde zonder voorloopnullen vergeleken; ZP00030 vergelijk ik als hoofdletter-tekst.
- **Wat wordt opgeslagen**:
  - `ondernemingen.exact_account_id` (nieuw);
  - `exact_account_naam` en `exact_koppeling_status`: gekoppeld, niet gevonden of dubbel.
- **Naamverschillen** komen uit een fuzzy vergelijking: Postgres `pg_trgm`, similarity onder 0,6. Dit is alleen ter info.

### 2. Abonnementen spiegelen
Drie nieuwe tabellen, elk met `opgehaald_op` en `sync_run_id`. Bij een nieuwe sync gaat een upsert op het Exact-ID; er wordt niets verwijderd.
- **`exact_abonnementen_spiegel`**, uit `subscription/Subscriptions`:
  - EntryID, Number, Description, OrderedBy (account), InvoiceTo, SubscriptionType;
  - StartDate, EndDate, CancellationDate, InvoicedTo, InvoicingStartDate, InvoiceDay;
  - PaymentCondition, Classification, BlockEntry.
- **`exact_abonnementsregels_spiegel`**, uit `subscription/SubscriptionLines`:
  - ID, EntryID, Item, ItemCode, ItemDescription, Quantity, UnitPrice, NetPrice, AmountDC;
  - FromDate, ToDate, LineType, UnitCode, VATCode.
- **`exact_abonnementstypes_spiegel`**, uit `subscription/SubscriptionTypes`: ID, Code, Description.
- **Artikelcodes** komen uit `logistics/Items` (ID, Code), zodat elk artikel een itemcode krijgt.
- **Ophalen** met `$select` en de `__next`-paginering. Ik houd me aan de limieten: maximaal 50 verzoeken per minuut en een stop bij 4.000 per dag. Bij een 429-melding wacht de functie op `X-RateLimit-Reset`.
- **Elke sync-run** komt in `exact_sync_log` met trigger_type `spiegel_sync` en de aantallen. Er gaan geen alarmmails uit, behalve de bestaande regel van maximaal 1 alarm per 24 uur bij een tokenfout.

### 3. Reconciliatie per contractregel
- Een view `exact_reconciliatie_v`. Koppeling op account (via `exact_account_id`) plus itemcode. Waar het abonnementsnummer gelijk is aan `abonnement_nr`, krijgt dat voorrang.
- Klassen, in deze volgorde. Een regel kan meerdere verschillen hebben; de eerste is de hoofdklasse en de rest gaat in een lijst:
  - Exact opgezegd, CRM actief (of andersom): CancellationDate of EndDate verleden ↔ CRM-status;
  - alleen in CRM;
  - alleen in Exact;
  - cyclusverschil: afgeleid uit het abonnementstype of de regelperiode, maand of jaar;
  - prijsverschil: UnitPrice × Quantity ↔ bedrag × aantal, met een tolerantie van 0,01;
  - datumverschil: begin- of einddatum, of InvoicedTo ↔ gefactureerd_tm;
  - match.

### 4. "Gefactureerd t/m" uit Exact overnemen
- Nieuwe kolommen in `klant_contracten`:
  - `afas_gefactureerd_tm` en `afas_volgende_factuurdatum`: eenmalig gevuld met de huidige waarden, voor de audit;
  - `gefactureerd_tm_bron`: 'afas' of 'exact';
  - `exact_abonnement_id` en `exact_abonnementsregel_id`.
- **Overnemen** gebeurt met een aparte, expliciete knop "Exact-stand overnemen" (supervisor/admin):
  - alleen bij een eenduidige match;
  - werkt alleen `gefactureerd_tm`, `volgende_factuurdatum` en de bron-kolom bij;
  - elke wijziging komt in `sensitive_audit_log` (oud en nieuw).
  - Daarna verwacht ik dat de 36 achterlopende regels naar 17-10-2026 of later schuiven. Het verslag laat zien welke regels dat niet doen.

### 5. Scherm "Exact-reconciliatie"
- Pagina **/admin/exact-reconciliatie**, alleen voor supervisor/admin:
  - tellingen voor het koppelen van relaties (gekoppeld, niet gevonden, dubbel, naamverschil);
  - tellingen per klasse, met een filter per klasse;
  - per regel CRM en Exact naast elkaar, met een link naar de klant;
  - de knoppen "Spiegel verversen" en "Exact-stand overnemen";
  - de banner dat facturatie vanuit het CRM nog uit staat.
- Op "Klanten & contracten": lidmaatschappen tonen als "Lidmaatschap (uitlopend)", zonder verkoop- of upsellknoppen.

### RLS
Spiegeltabellen en nieuwe kolommen volgen deze rechten:
- lezen: team, `TO authenticated`;
- schrijven: alleen de functie (service_role); de enige uitzondering is de overneemknop, en die loopt via een RPC voor supervisor/admin;
- anon: geen rechten.

## Fase 2: het CRM schrijft naar Exact (alleen plan)

### Wachtrij `exact_wijzigingen`
- **Velden**:
  - actie: abonnement_aanmaken, regel_toevoegen, prijs_wijzigen, einddatum_zetten, opzeggen;
  - onderneming_id, klant_contract_id;
  - payload (het voorstel) en exact_stand (snapshot uit de spiegel), plus de diff;
  - status: concept → goedgekeurd → verstuurd → bevestigd of fout;
  - aangemaakt_door, goedgekeurd_door, goedgekeurd_op;
  - idempotentiesleutel (uniek): hash van actie, contractregel en payload;
  - exact_response en foutmelding.
- **Volledige log** in `exact_wijzigingen_log`: elke statusovergang wordt alleen toegevoegd.
  - Een trigger blokkeert verwijderen. Bijwerken mag alleen langs de statusovergangen.
- **Concepten**: een trigger op `klant_contracten` maakt een concept aan bij een nieuw contract, prijs, cyclus, einddatum of opzegging. Hij verstuurt niets.
- **Goedkeuren** via een RPC, alleen voor supervisor/admin.
  - Mijn voorstel: wie een wijziging heeft gemaakt, mag die niet zelf goedkeuren (vier-ogen). Graag je akkoord.

### Versturen
Functie `exact-wijziging-versturen`. Per goedgekeurde actie:
1. Lees de actuele Exact-stand. Wijkt die af van de snapshot, dan wordt de status fout ("Exact is intussen gewijzigd") en verstuurt hij niets.
2. Doe precies één POST of PUT, met de idempotentiesleutel in de omschrijving of notities, zodat een dubbele poging herkenbaar is.
3. Lees terug ter controle → bevestigd. Wijkt het teruggelezen resultaat af, dan wordt de status fout. Er komt geen automatische nieuwe poging.

Exact-endpoints per actie:
- **Abonnement aanmaken**: POST `subscription/Subscriptions` (OrderedBy, InvoiceTo, SubscriptionType, StartDate, EndDate, PaymentCondition), met de regels in `SubscriptionLines`.
- **Regel toevoegen**: POST `subscription/SubscriptionLines`.
- **Prijs wijzigen**: zet ToDate op de oude regel met PUT `SubscriptionLines(guid)` en POST een nieuwe regel vanaf de nieuwe datum. Zo blijft de historie zichtbaar.
- **Einddatum en opzeggen**: PUT `Subscriptions(guid)` met EndDate, CancellationDate en ReasonCancelled.

### Dubbele facturatie technisch uitsluiten (advies: maandcron ombouwen tot alleen controle)
- Ik adviseer **de maandcron definitief uit te schakelen als factureerder** en hem om te bouwen tot een dagelijkse **alleen-lezen controle**. Exact factureert vanuit abonnementen; de cron meldt alleen nog afwijkingen, zoals een abonnement zonder factuur of een factuur zonder abonnement. Er is dan nog maar één systeem dat factureert.
- Harde blokkades:
  1. Het verzendgedeelte van `monthly-invoices-cron` wordt verwijderd. In de code komt een test die controleert dat er geen POST naar `SalesInvoices` in staat.
  2. `lead-to-exact-activate` maakt geen eerste losse factuur meer. In plaats daarvan maakt hij een concept "abonnement aanmaken" dat Roxy of Sandra goedkeurt. Exact factureert de eerste periode dan zelf.
  3. Een database-functie `mag_site_factureren(lead_id)` geeft false zodra er een gekoppeld Exact-abonnement is. Elke resterende losse-factuurroute (`polis-lifecycle`, creditnota's bij pauze of opzegging) controleert dat. Is er een abonnement, dan loopt pauze of opzegging via `einddatum_zetten`/`opzeggen` en niet via een losse creditnota.
  4. Een unieke index: per contractregel mag maar één actief Exact-abonnement bestaan.
- `polis-lifecycle` moet na fase 2 ook via de wachtrij lopen. Dat neem ik mee in fase 2.

## Technische details
- Migraties fase 1:
  - de kolommen op `ondernemingen` en `klant_contracten`;
  - de 3 spiegeltabellen en de view `exact_reconciliatie_v`;
  - de RPC `neem_exact_stand_over(contract_ids uuid[])`: SECURITY DEFINER, supervisor-check, logt naar het audit-log;
  - de extensie `pg_trgm`.
- Gedeelde helper `_shared/exactCodeMatch.ts` (trim, numeriek of tekst), met unit-tests.
- Tests:
  - code-matching;
  - classificatie (pure functie, ook in de frontend-lib);
  - de controle dat er geen schrijfmethode in `exact-spiegel-sync` staat;
  - anon kan de spiegel niet lezen.
- Vóór en na de sync tel ik `exact_sync_log`, de mail-logs en `leads`; alleen `exact_sync_log` mag stijgen. Daarna build, tests, typecontrole, deno check en de security-scan. Niet publiceren.

## Vragen
1. **Vier-ogen**: mag wie de wijziging maakt hem zelf goedkeuren? Mijn voorstel is nee.
2. **Lege velden**: Exact heeft per abonnement een InvoicedTo. Als die leeg is, mag ik de laatste factuurperiode dan afleiden uit `SalesInvoiceLines`? Dat is ook alleen lezen.
3. **Niet gevonden**: relaties die niet in Exact staan, markeer ik alleen. Ze krijgen pas in fase 2 een concept "relatie aanmaken". Akkoord?
