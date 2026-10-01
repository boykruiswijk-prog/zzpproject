# Fase 2 — De site als factuurplanner (Exact-concepten)

Vervangt het eerdere fase 2-ontwerp. Er komen geen Exact-abonnementen. Bouwen begint pas na akkoord. Zolang de hoofdschakelaar uit staat, schrijft niets iets naar Exact.

## Gecontroleerde startstand (gelezen voor dit plan)
- 36 actieve regels hebben `volgende_factuurdatum` op of vóór 16-10-2026.
- Er zijn 70 regels met een startdatum tussen 17 en 31-10-2026, samen € 9.738,00. Dat klopt met de verwachte ~70 regels en ~€ 9.700.
- `monthly-invoices-cron-daily` bestaat en staat uit.
- In `exact_config` staat `gl_code_bav` = 8003. BAV-AVB loopt via `_shared/exactGl.ts` en is daar al 8003 met een cache op code. Voor de laatste bevestiging vergelijkt `exact-gl-check` de grootboekrekening die op het artikel zelf staat (`GLRevenueCode`).
- Er staat één artikel in de spiegel: BAV-AVB. Waarom het er maar één is, is nog niet zeker. Het kan aan rechten liggen, of aan een filter in de sync. Dat zoek ik eerst uit (stap 1).
- Productcodes in het CRM: 100-varianten (BAV-AVB), 100HDI, 102/102J (Cyber Clear), 400 Start-up, 425 Light, 450 All-in, Nimble.

## Artikelen en grootboek (eerst onderzoeken, niets aanmaken)
Een alleen-lezen diagnose haalt `logistics/Items` op (Code, Description, IsSalesItem, GLRevenue, GLRevenueCode, gepagineerd en zonder filter). Daarnaast leest hij `SalesInvoiceLines` van de laatste handmatige run, om te zien welke Item- en GLAccount-combinaties de administratie echt gebruikt.

Voorstel voor de mapping, te bevestigen met die gegevens:

| Product | Artikel in Exact | Grootboek |
|---|---|---|
| BAV-AVB (100-varianten, 100HDI?) | BAV-AVB | 8003 |
| Cyber Clear (102, 102J) | onbekend, opzoeken | uit artikel |
| Lidmaatschap All-in / Start-up / Light (450/425/400) | onbekend, opzoeken | uit artikel |
| Nimble | onbekend, opzoeken | uit artikel |

- De mapping komt in de tabel `factuur_artikel_mapping`.
- Een product zonder bevestigd artikel blokkeert de facturatie, met de reden "artikel ontbreekt". Er wordt niets geraden.
- Of 100HDI onder BAV-AVB valt, vraag ik na als Exact dat niet laat zien.
- Hoort de factuurregel bij een artikel met een andere grootboekrekening dan die in de mapping, dan meldt het scherm dat.

## Datamodel (één migratie)
- **`facturatie_config`** (één rij):
  - `facturatie_actief` (standaard false), `cron_tijd` en `verwerk_termijn_werkdagen` (5);
  - alleen admin mag bijwerken (has_role admin), team-supervisor mag lezen;
  - elke wijziging gaat naar `sensitive_audit_log`.
- **`factuur_artikel_mapping`**:
  - `itemcode_patroon`, `product`, `exact_item_id`, `exact_item_code`, `gl_code`, `bevestigd` (boolean);
  - alleen admin mag schrijven.
- **`factuur_planning`**, één rij per te factureren periode:
  - `klant_contract_id`, `periode_start`, `periode_eind`, `bedrag`, `aantal`, `exact_account_id`, `item_id`, `planningssleutel` (kort, bijvoorbeeld `ZPF-<8 tekens>`);
  - `status`: proef | concept_aangemaakt | verwerkt | verwijderd_in_exact | te_laat | fout;
  - `exact_invoice_id`, `exact_invoice_number`, `exact_status`, `invoice_date`, `aangemaakt_op`, `verwerkt_op`, `laatst_gecontroleerd_op`, `foutmelding`;
  - `UNIQUE(klant_contract_id, periode_start)` en `UNIQUE(planningssleutel)`;
  - een regel ontstaat alleen via `INSERT ... ON CONFLICT DO NOTHING`;
  - de RLS geeft het team leesrecht, en alleen service_role mag schrijven.
- **`factuur_planning_log`**: alleen toevoegen, voor elke statuswissel met oud en nieuw.
- **`ondernemingen`**: nieuwe kolommen `facturatie_blokkade` (text, nullable) en `facturatie_blokkade_reden`. Startwaarden via een data-actie:
  - 2009361 krijgt "conflict: Exact = TEST business@ventures, CRM = TSP Security";
  - 2006408 krijgt "conflict: Pharmation / Conspectus".
- **RPC's** (SECURITY DEFINER, vaste search_path, minimale EXECUTE):
  - `facturatie_kandidaten(_van, _tot)`: rekent per dag en per regel uit wat er gemaakt zou worden, met een blokkadereden. Mogelijke redenen: geen Exact-code, conflict, artikel ontbreekt, regel loopt af of is vervangen, of al gepland.
  - `doorrol_startstand(_preview boolean)`: alleen supervisor of admin.
  - `factuur_opnieuw_inplannen(_planning_id)`: alleen supervisor of admin, en alleen bij de status verwijderd of te_laat. De oude rij wordt gearchiveerd met de status `vervangen`. De nieuwe rij krijgt een nieuwe sleutel voor dezelfde periode. Daarom geldt de unieke sleutel alleen voor actieve statussen, via een partial unique index.
- De verwijderde maandcron laat `monthly_invoices_log` staan. Die tabel wordt niet meer gevuld en krijgt het commentaar DEPRECATED.

## Periode en bedrag
- `periode_start` = `volgende_factuurdatum`.
- `periode_eind` = start + 1 maand (of 1 jaar) − 1 dag, volgens de kalender. Een start op 31-01 eindigt dus op 27-02 of 28-02.
- Bedrag = `bedrag_per_periode × aantal`.
- Na `verwerkt` worden `gefactureerd_tm` en `volgende_factuurdatum` op de contractregel doorgezet, met een vermelding in het audit-log.
- Een periode die `concept_aangemaakt` is, telt al als bezet.
- De pure helper `_shared/factuurPeriode.ts` staat ook byte-gelijk in `src/lib`, met unit-tests.

## Startstand
1. **Doorrollen**: `doorrol_startstand(true)` geeft per regel de oude en nieuwe `gefactureerd_tm` en `volgende_factuurdatum` terug, plus het aantal cycli. Rij 610 komt uit op 17-10-2026. Ik lever eerst deze preview aan. Pas na jouw akkoord volgt `(false)`, met een regel in `sensitive_audit_log` per wijziging.
2. **Controle (alleen lezen)**: een GET op `salesinvoice/SalesInvoices` met `$filter=Created ge datetime'<−7 dagen>' or InvoiceDate ge ...`. Daarna volgen de `SalesInvoiceLines` van die facturen. Elke doorgerolde regel wordt gekoppeld via `InvoiceTo` (account) en het artikel of bedrag. Het rapport bevat drie lijsten: met factuur, zonder factuur, en twijfel.

## Exact-endpoints en -velden
- **Aanmaken**: `POST salesinvoice/SalesInvoices`, met dezelfde helpers als de activatie:
  - kop: `OrderedBy` en `InvoiceTo` (account-ID), `Journal`, `PaymentCondition`, `InvoiceDate` = periode_start;
  - `YourRef` = `factuurReferentie` + planningssleutel, en `Description` met de periode vooraan, beide via `_shared/factuurTekst.ts` en maximaal 60 tekens;
  - `SalesInvoiceLines`: `Item`, `Quantity` = aantal, `NetPrice` = bedrag_per_periode, `GLAccount` uit de mapping, `VATCode` vrijgesteld zoals nu, en `Description` met de periode;
  - een SalesInvoice die via de API wordt aangemaakt, krijgt in Exact standaard `Status` 20 (concept). Er wordt nooit `PrintedSalesInvoices` aangeroepen; boeken en versturen doet Roxy.
- **Idempotentie**:
  - eerst de planningsrij op `fout_pending` zetten (geclaimd);
  - dan `GET SalesInvoices?$filter=substringof('<sleutel>',YourRef)`. Bestaat de factuur al, dan wordt die gekoppeld en wordt er niets aangemaakt;
  - pas daarna de POST;
  - bij een timeout of een onbekende uitkomst blijft de rij geclaimd en stopt de run. Dezelfde GET lost dat de volgende run op, zodat er nooit een dubbele factuur ontstaat.
- **Status uitlezen**: `_shared/exactInvoiceStatus.ts` (`InvoiceID, InvoiceNumber, Status, YourRef, InvoiceDate`), in batches op ID:
  - 20 = concept;
  - 50 = verwerkt (geboekt);
  - een ID dat niet meer bestaat = verwijderd in Exact.
- **Verwerkt**: alleen bij `Status = 50`. Daarbij komen `InvoiceNumber` en `InvoiceDate` erbij.
- **Te laat**: status 20 terwijl er meer dan 5 werkdagen (NL, zonder weekend) voorbij zijn sinds aanmaak. Dat geeft een melding; er komt geen nieuw concept.
- **PDF**: het bestaande pad in `get-invoice-pdf`. De site controleert eerst `SalesInvoices(guid)` op eigenaar en `Status = 50`, en haalt daarna `/docs/XMLDownload.aspx?Topic=SalesInvoice&Format=Pdf&Params_InvoiceID=..&Division=4401707` op. Concepten worden geweigerd. Werkt dit pad niet voor een verwerkte factuur, dan valt het terug op `Documents` + `DocumentAttachments` (`Attachment`-URL) met `Type` = verkoopfactuur. Welke variant werkt, test ik read-only op één bestaande verwerkte factuur.

## Planner (`factuur-planner`, cron dagelijks om 06:00 Europe/Amsterdam)
- Authenticatie via `x-cron-secret` uit Vault.
- Werkt eerst de status bij van open concepten. Daarna berekent hij de kandidaten voor vandaag, plus achterstallige kandidaten die niet geblokkeerd zijn.
- **Staat `facturatie_actief` uit**: alleen proefrijen of een rapport. Er staat geen enkel POST-pad open. De Exact-client van de planner krijgt een guard die POST weigert als de vlag niet in de DB-read van dezelfde run waar is.
- **Staat de schakelaar aan**: per regel claimen, controleren en aanmaken. Een fout geldt per regel: die regel krijgt `fout` en de rest loopt door. Er wordt niets half aangemaakt, want één factuur is één POST.
- Alarm via de bestaande `sendExactAlarm`, met dedupe op maximaal één per dag (de 24-uursregel per genormaliseerde fout).

## Activatie van nieuwe klanten
`lead-to-exact-activate` blijft zoals hij is, met de eerste factuur. Pas na een geslaagde factuur maakt hij ook:
- een onderneming, als die er nog niet is (op `exact_relatie_code` of account);
- een regel in `klant_contracten` met:
  - bron `site_activatie` en `bron_rij` = hash van de lead;
  - `itemcode` en `product` uit het gekozen pakket, `cyclus` maand of jaar en `bedrag_per_periode`;
  - `gefactureerd_tm` = einde van de eerste periode, en `volgende_factuurdatum` = de dag erna.

Dit gaat idempotent, via unieke bron/rij. Testleads krijgen `is_test` en worden door de planner altijd overgeslagen.

## Wat verdwijnt
- `supabase/functions/monthly-invoices-cron` wordt verwijderd, samen met de cron-job `monthly-invoices-cron-daily`.
- `test-exact-invoice-periods` wordt verwijderd als het alleen voor de maandcron bestond.
- In `polis-lifecycle` controleer ik of daar losse vervolgfacturen worden gemaakt. Het hervat-pad dat een factuur maakt, gaat dan via de planningstabel (unieke periode), zodat er maar één factuurroute is. Creditnota's blijven ongewijzigd.

## Beheer
- **`/admin/facturatieplanning`** (admin en supervisor):
  - de status van de hoofdschakelaar; alleen admin ziet de knop;
  - een datumbereik, standaard 17 t/m 31-10-2026;
  - per dag de regels, met totalen per maand en jaar;
  - een blokkadereden per regel;
  - een tab met open concepten, verwijderde concepten en te late concepten, met de knop "Opnieuw inplannen".
- **Onder `/admin/klanten`**: de lijst "Blokkeert facturatie" (20 zonder code en 2 conflicten).

## Mijn ZP: Facturen
- `get-customer-invoices` wordt gefilterd op:
  - de accounts van de klant, via de RPC persoon → onderneming → `exact_account_id`;
  - `Status = 50`;
  - `InvoiceDate ≥ 2026-10-17`.
- Per factuur toont het nummer, datum, periode (uit `factuur_planning`, anders uit de omschrijving) en bedrag. Er staat geen betaalstatus bij.
- De PDF gaat via `get-invoice-pdf`, met dezelfde controles.
- De site stuurt geen mail.

## Testplan (geen Exact-write zolang de schakelaar uit staat)
- **Unit**: periodes (maandeinde, schrikkeljaar, jaar), bedrag, sleutel en YourRef (≤ 60 tekens), werkdagen, statusovergangen en blokkaderedenen.
- **Planner met de schakelaar uit**: een guard-test met een gemockte fetch die faalt bij elke niet-GET. De proefrun voor 17–31 okt moet ongeveer 70 regels en ongeveer € 9.738 geven, minus de geblokkeerde regels; dat verschil wordt verklaard.
- **Database**: een dubbele insert met dezelfde (contract, periode_start) faalt. De RLS laat anon en klant niets lezen. Alleen admin kan de schakelaar zetten.
- **Doorrol-preview**: 36 regels, en rij 610 komt uit op 17-10-2026.
- **Exact alleen-lezen**: de artikeldiagnose, de controle van de afgelopen 7 dagen en een PDF-test op één verwerkte factuur.
- **Activatie**: droogrun of mock die de contractregel maakt, voor een @zpzaken.nl-testlead met `is_test`.
- **Afsluitend**: build, tests, typecheck, deno check en security-scan. Ik vergelijk het aantal regels in de mail-, uitnodigings-, factuur- en planningstabellen vóór en na.
- Ik publiceer niets en verwijder geen logregels.

## Volgorde na akkoord
1. Migratie, helpers en tests; daarna de artikeldiagnose en de 7-dagencontrole (alleen lezen), met rapport.
2. Doorrol-preview, met rapport. Ik wacht op jouw akkoord voordat ik doorrol.
3. Planner (schakelaar uit), beheerscherm, proefrun 17–31 okt en het activatie-aanvulstuk; daarna de maandcron verwijderen.
4. Mijn ZP: Facturen.
5. Boy of een admin zet `facturatie_actief` pas zelf aan na akkoord op de proefrun en de mapping.

## Open vragen
- Valt 100HDI onder het artikel BAV-AVB?
- Moet `InvoiceDate` van het concept periode_start zijn, of de aanmaakdag? (Voorstel: periode_start.)
- Moet de planner achterstallige kandidaten automatisch meenemen nadat hij een dag heeft gemist? (Voorstel: ja, maar alleen als ze niet geblokkeerd zijn.)
