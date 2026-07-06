
# KPI-onderzoek supervisor-dashboard — bevindingen

Alleen rapportage; geen wijzigingen voorgesteld.

## 1. Actieve polissen — welke bron?
Twee bronnen, **niet synchroon**:
- `leads.status = 'actief'` → **4 leads**.
- `policies` totaal → **20 records**, waarvan **9 zonder `lead_id`** (handmatig aangemaakte certificaten, o.a. door Ellen). Verdeling van polissen naar lead-status: 4 actief, 4 klant, 3 afgewezen, **9 zonder lead**.
- Legacy status `klant` (4 leads) bevat oude klantrecords die in `leads.status` niet als `actief` staan, maar wel een polis hebben.
- `policies` heeft geen eigen status-/einddatumkolom die "actief" markeert; er is wel `polis_einddatum` op **leads** (opzegging).

**Betrouwbaarste definitie**: `leads.status IN ('actief','gepauzeerd')` — maar dat mist de historische `klant`-records met polis. Voor een echt actueel aantal is `leads` de bron; `policies` is een certificatenregister met testrecords en losstaande handmatige certs.

## 2. Portefeuillegroei per maand
- `leads.geactiveerd_op` bestaat en is gevuld voor **slechts 2 leads** (beide juli 2026, Boy Kruiswijk testruns).
- `activiteiten_log.actie_type = 'lead_geactiveerd'` → **0 records**. Deze actie wordt momenteel niet gelogd. Bestaande types: `lead_binnengekomen`, `lead_in_behandeling`, `lead_goedgekeurd`, `lead_afgewezen`, `portaal_invite_verstuurd`, `artikel_aangemaakt`, `artikel_gegenereerd_met_claude`.
- Legacy `klant`-leads hebben geen `geactiveerd_op` → tellen niet mee in een maandgrafiek op basis van dat veld.

Groei-per-maand op `geactiveerd_op` is **technisch mogelijk** maar cijfermatig **nog leeg** (2 datapunten). `policies.created_at` is een alternatief maar bevat testcerts en losse handmatige certs.

## 3. MRR / maandelijkse premie-omzet
- Premiebedrag: `leads.exact_invoice_amount` (numeric). Gevuld voor **2 van de 4 actieve leads** (€53,23 en €1,83 — beide testbedragen).
- Betaalritme: `leads.omzet` (text!) met waarden `maandelijks`, `jaarlijks`, `1`, of NULL. Ook `leads.gekozen_pakket` bevat `maandelijks`/`jaarlijks`. Twee overlappende bronnen; `omzet` is misbruikt als frequentie.
- `policies.package_type` bevat ook "Maandelijks"/"Jaarlijks" in tekstvorm (`BAV & AVB Maandelijks`).
- Standaardpremies (€30 maand / €45 combi, uit memory) staan **niet als vaste kolom** in de DB; alleen wat Exact terugkoppelde.

**Betrouwbare MRR-som is nu niet mogelijk**: bedrag ontbreekt bij helft van actieve leads; frequentieveld is inconsistent (`omzet` = tekst met deels `1`). Voor een indicatie moet het dashboard terugvallen op vaste tarieven per `gekozen_pakket`.

## 4. Funnel & conversie
Voorkomende `lead_status`-waarden in data: `nieuw` (5), `offerte_verstuurd` (1), `actief` (4), `afgewezen` (4), `klant` (4). Enum bevat volgens triggers óók `gepauzeerd` en `opgezegd` (nu 0).
- **`klant`** is een legacy-status: alle 4 hebben polissen maar staan niet als `actief`. Zonder normalisatie vertekent dit conversie.
- `in_behandeling` / `goedgekeurd` bestaan **niet** als lead-status, wel als log-events. Funnel-fases kunnen dus deels uit `activiteiten_log` komen, deels uit `leads.status`.
- Conversie binnenkomst→actief: 4 / 18 = 22% ruw; na filteren testdata blijft **~1 echte activatie** over → cijfer is statistisch niet zinvol.

## 5. Verwerkingstijd
- `leads.created_at` bestaat voor alle 18 leads.
- `geactiveerd_op` alleen gevuld voor **2 leads** → doorlooptijd berekenbaar voor 2 records (respectievelijk ~1u en ~23u — beide testruns).
- `activiteiten_log.lead_geactiveerd` bestaat niet als type; fallback via log is nu leeg.

## 6. Opzeggingen / retentie
- Velden aanwezig op **leads**: `opzeg_datum`, `opzeg_reden`, `opzeg_toelichting`, `opzeg_door`, `pauze_start_datum`, `heractivering_datum`, `polis_einddatum`.
- Enum-statussen `opgezegd` en `gepauzeerd` bestaan (guard-triggers refereren eraan), maar **0 leads** staan er nu op.
- `sensitive_audit_log` registreert opzeggen (`actie='opzeggen'`) en activatie-terugdraaien; is de canonieke bron voor historische opzegcohorten.
- `activiteiten_log` heeft **geen** `lead_opgezegd`-type.

Opzegpercentage: technisch bepaalbaar via `leads.opzeg_datum IS NOT NULL` / actieve+opgezegde populatie, maar nu 0 gevallen — cijfer is 0%.

## 7. Testdata-vervuiling
Ruwe telling met filter `email ILIKE '%test%' OR '%example.com%' OR naam/bedrijf ILIKE '%test%'` → **11 van 18 leads (61%)** zijn duidelijk test.

Concreet in de data:
- E2E Loggie (`e2e.loggie@example.com`)
- 3× Boy Kruiswijk (`boy.kruiswijk@zpzaken.nl` / `boy@onefellow.nl`, bedrijf "test mail bv" / "zpwerkt")
- Test Maandklant, Test Anon, Test User, TEST Lovable
- Roxy Taskin & Gert-Jan Schellingerhout op `@example.com`/`@example.nl`
- Simulatie Testklant, Test Maandelijks, Jan de Vries (`@testbedrijf.nl`)

Bruikbaar filter zonder schemawijziging (samengesteld):
```
email ILIKE '%@example.%'
 OR email ILIKE '%test%'
 OR email IN ('boy.kruiswijk@zpzaken.nl','boy@onefellow.nl','ellen.baars@zpzaken.nl','ellenbaarsn@gmail.com')
 OR bedrijfsnaam ILIKE 'TEST %' OR bedrijfsnaam ILIKE '%test%'
 OR voornaam ILIKE 'test%' OR achternaam ILIKE 'Testklant'
```
Bezwaren:
- interne medewerkers (Boy, Ellen) gebruiken echte @zpzaken.nl-adressen voor tests → niet te onderscheiden van echte klanten die dat adres ooit zouden gebruiken.
- Roxy Taskin / Schellingerhout hebben `@example.*` maar staan wel als `klant` met polis (waarschijnlijk seed).
- `policies` heeft 9 records **zonder lead_id** die niet via lead-filter weg te krijgen zijn.

**Conclusie**: heuristisch filter dekt ~90% maar is fragiel. Voor een betrouwbaar supervisor-dashboard is een `is_test boolean` (of `omgeving`-enum) op **leads** én **policies** de enige robuuste route; anders blijven mensen zoals Boy zelf altijd meegeteld worden als echte activatie.

## Samenvatting harde cijfers vandaag
| KPI | Waarde uit DB | Bruikbaar? |
|---|---|---|
| Actieve leads | 4 | Ja, maar 3 zijn test |
| Polissen totaal | 20 | Bevat 9 zonder lead + testrecords |
| Leads met `geactiveerd_op` | 2 | Beide test |
| Activaties in log | 0 | Event wordt niet gelogd |
| Leads met premiebedrag | 2 | Testbedragen |
| Opzeggingen | 0 | Veld bestaat, leeg |
| Testleads (heuristiek) | 11/18 (61%) | Filter mogelijk, niet waterdicht |

## Aanbevelingen voor bouwfase (niet uitvoeren)
1. Kies **`leads`** als single source of truth voor "actieve polis" en beschouw `policies` als certificatenregister.
2. Voeg `activiteiten_log`-events toe voor `lead_geactiveerd` en `lead_opgezegd` zodat trend-KPI's een consistente bron krijgen.
3. Normaliseer betaalritme: kies of `omzet` óf `gekozen_pakket`, niet beide; overweeg numerieke `premie_bedrag` + enum `betaalritme` op leads.
4. Voer `is_test boolean` (default false) in op `leads` en `policies` en markeer bestaande records — zonder dat blijft elk dashboard onbetrouwbaar.
5. Legacy `klant`-status migreren naar `actief` óf expliciet meenemen in KPI-definities.
