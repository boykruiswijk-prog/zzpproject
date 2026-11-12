# Scenariotests

Besluit Boy 12-11-2026 12:16. Elke wijziging wordt vóór publicatie doorgetest zonder echte klantdata te raken en zonder testdata achter te laten.

## Vaste testpersoon

| Wat | Id | Gegevens |
|---|---|---|
| Persoon | `7e570000-0000-4000-8000-000000000001` | Testpersoon ZP Zaken, test+testpersoon@zpzaken.nl |
| Onderneming A | `7e570000-0000-4000-8000-00000000000a` | Testpersoon ZP Zaken, Eenmanszaak, KvK 99000101 |
| Onderneming B | `7e570000-0000-4000-8000-00000000000b` | Testpersoon ZP Zaken BV, BV, KvK 99000102 |
| Klantsessie | `7e570000-0000-4000-8000-00000000000c` | alleen als gesimuleerde uid, geen account |

Alles staat op `is_test = true`. Nooit verwijderen. Geen contracten, polissen of notities blijvend op de testpersoon zetten: scenario's bouwen die zelf op en draaien ze terug.

## Database-scenario's draaien

Alleen als service_role of postgres (niet anon of authenticated), bijvoorbeeld met het run_sql-hulpmiddel:

```sql
select public.test_scenario('alle');              -- alles, met rijen_voor/rijen_na
select public.test_scenario('ingangsdatum_ok');   -- één scenario
```

Uitkomst: `{scenario, geslaagd, controles:[{naam, verwacht, gekregen, ok}]}`. Elk scenario eindigt met de controle
`0 nieuwe rijen na terugdraaien` (tellingen van 17 tabellen vóór en na). Bij `alle` staat `nul_rijen_achtergebleven`.

Werking: testdata wordt binnen een subtransactie opgebouwd, de echte RPC's draaien met een gesimuleerde sessie
(`request.jwt.claims`: admin-uid met aal2, of de klant-uid), de uitkomst wordt vastgelegd en een interne exception
(SQLSTATE P0T01) draait alles terug. Hulpfuncties: `_ts_c`, `_ts_sessie`, `_ts_tel`, `_ts_contract`, `_ts_polis`, `_ts_fout`, `_ts_rechtsvorm_aanvraag`.

## TypeScript-scenario's

Logica die in TypeScript staat (maatwerk, creditroute, labels, datummeldingen) draait in vitest met dezelfde namen:

```bash
bunx vitest run src/test/scenarios1211.test.ts            # alles
bunx vitest run src/test/scenarios1211.test.ts -t maatwerk_zorg
```

`test_scenario` geeft voor deze namen `soort: vitest` en `geslaagd: null` terug, zodat ze nooit als SQL-geslaagd tellen.

## Publiek formulier (Playwright, niet inloggen, niet verzenden)

`python3 scripts/scenario_formulier.py` opent /bav-zzp op 375 px, blokkeert alle aanroepen naar serverfuncties en
alle schrijfacties (er ontstaat dus geen concept of aanvraag), loopt tot stap 2, controleert de maatwerk-popup per sector
en het i-icoon bij Aantal medewerkers.

## Nieuwe fix = nieuw scenario

1. Voeg een tak toe in `test_scenario` (nieuwe migratie met CREATE OR REPLACE) en zet de naam in de lijst voor `alle`,
   of voeg een `describe("<naam>")` toe in `src/test/scenarios1211.test.ts` als de logica in TypeScript staat.
2. Draai `select public.test_scenario('alle')` en de vitest-run; beide moeten slagen en `nul_rijen_achtergebleven` moet true zijn.

## Certificaatnummer (spoed 12-11-2026)
- `certificaat_polis_via_lead`: polis met alleen een lead krijgt bij aanmaken de onderneming; het dialoog vindt het bestaande nummer en "nieuw nummer" wordt geweigerd.
- `certificaat_ingangsdatum`: ingangsdatum wijzigen bij een polis zonder onderneming_id: zelfde nummer, nieuwe datum, één geldige polis.
- `certificaat_nieuwe_klant`: echt nieuwe klant krijgt geen bekend nummer en mag een nieuw nummer krijgen.

## Exact-adres (12-11)
- `exact_adres_test_nooit`: testonderneming komt nooit in de Exact-wachtrij.
- `exact_adres_wachtrij`: alleen een adreswijziging maakt precies één open rij; een fout-rij gaat bij een nieuwe wijziging terug naar wacht.
- Vitest `src/test/exactAdres1211.test.ts`: allowlist, alleen adresvelden, terugleescontrole, fout geeft melding.
