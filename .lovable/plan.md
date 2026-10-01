# Rapport sectorlijsten (alleen lezen, niets gewijzigd)

## 1. Afsluitformulier (BAV-wizard / "Direct afsluiten")
Bron: `src/data/sectorVerzekeringskaart.ts` r17-27 (`WIZARD_SECTOREN`), getoond in `src/components/home/BAVApplicationModule.tsx` r636-647 (stap 2, verplicht). Verstuurd wordt het **label** (r255).

| # | value (id) | label | kaart |
|---|---|---|---|
| 1 | ict | ICT | eigen |
| 2 | management-consultancy | Management consultancy | eigen |
| 3 | pr-marketing | Reclame- & marketingbureaus | eigen |
| 4 | coaches | Coaches | eigen |
| 5 | zakelijke-dienstverlening | Zakelijke dienstverlening | eigen |
| 6 | zorg | Zorg | fallback MPH-2013B |
| 7 | bouw | Bouw & techniek | fallback |
| 8 | overig | Overig | fallback |

## 2. Offerteformulier
Enige variant: `src/pages/OffertePage.tsx` r46-53 (`BRANCHES`), route `/offerte` (`src/App.tsx` r154, ook onder /en /de /fr via hetzelfde onderdeel; alleen NL-teksten, geen vertaling van de lijst). Geen modal; ThreeOptionCTA en Footer linken alleen naar `/offerte`.

| # | value | label |
|---|---|---|
| 1 | ict | ICT (IT & ICT) |
| 2 | management-consultancy | Management consultancy (HR & Finance consultancy) |
| 3 | pr-marketing | Reclame en marketing (PR & Marketing) |
| 4 | coaches | Coaches |
| 5 | zakelijke-dienstverlening | Zakelijke dienstverlening (Niet-uitvoerende beroepen) |
| 6 | anders | Anders |

Verstuurd wordt de **value** (slug).

## 3. Backend-ontvangst offerte
- `submit-public-form`: tabel/kolom-whitelist (`beroep`, `branche`, `extra_data` toegestaan), alleen tekst ingekort tot 5000 tekens; **geen waardelijst/zod** op sector.
- Offerte schrijft slug naar `leads.beroep` en `extra_data.branche`; **`leads.branche` blijft leeg**. `anders` zet `vereist_handmatige_beoordeling`.
- DB: `leads.beroep` en `leads.branche` zijn vrije tekst; geen enum of check-constraint.
- `send-lead-notification`: mailveld "Branche" = label uit de frontendlijst; geen validatie.
- CRM (`LeadDetail.tsx`): toont `beroep` (r390, dus de slug), extra_data-blok voor offertes (r500); branche-select gebruikt `ADMIN_BRANCHES` (r419).
- `sectorBranche.ts` (`brancheVoorSector`) en `sectorVerzekeringskaart.ts` worden **niet** gebruikt door de offerte. `brancheVoorSector` verwacht wizard-**labels** (bv. "ICT"); offerte-slugs ("ict") geven `null`. `verzekeringskaartVoorSector` verwacht wizard-**ids**, en zou offerte-slugs 1-5 wel herkennen, `anders` niet.
- Conclusie: de backend accepteert elke tekst, dus ook de afsluitwaarden; er vindt echter geen mapping naar branche/kaart plaats.

## 4. Tests
- `src/test/sectorBranche.test.ts`: 8 wizardlabels → adminbranche, onbekend → null.
- `src/test/sectorVerzekeringskaart.test.ts`: elke wizardsector heeft bestaande PDF; fallback = MPH-2013B; onbekend → null.
- Geen test voor de offertelijst.

## Verschil
| value | Afsluiten | Offerte |
|---|---|---|
| ict | ICT | ICT (IT & ICT) |
| management-consultancy | Management consultancy | Management consultancy (HR & Finance consultancy) |
| pr-marketing | Reclame- & marketingbureaus | Reclame en marketing (PR & Marketing) |
| coaches | Coaches | Coaches |
| zakelijke-dienstverlening | Zakelijke dienstverlening | Zakelijke dienstverlening (Niet-uitvoerende beroepen) |
| zorg | Zorg | ontbreekt |
| bouw | Bouw & techniek | ontbreekt |
| overig | Overig | ontbreekt |
| anders | ontbreekt | Anders |

Daarnaast: wizard stuurt het label, offerte de slug; adminbranche "HR & Finance consultancy" komt in de wizardmapping niet voor maar staat in het offertelabel bij Management consultancy.

Geen wijzigingen voorgesteld; geef aan of de lijsten gelijkgetrokken moeten worden.
