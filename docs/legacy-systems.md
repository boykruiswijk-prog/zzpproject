# Legacy systemen — uitgefaseerd

**Datum:** 2026-06-24

Het legacy facturatie-systeem is uitgefaseerd. Facturatie loopt nu volledig via Exact Online
(divisie `4401707` — ZP Zaken B.V.) via de Edge Function `lead-to-exact-activate`.

## Uitgefaseerd

- `public.invoices` tabel — leeg, behalve `ZPF-2026-1026` (status `legacy_void`)
- `generate-invoice` Edge Function — actief als 403-stub (deprecated)
- `invoice_number_seq` sequence — behouden read-only
- `generate_invoice_number()` trigger — behouden read-only (geen inserts mogelijk via 403)
- `export-ubl` Edge Function — **verwijderd**
- `BillingNotifications` admin-component — niet meer gerenderd op dashboard (in git-historie behouden)

## Portaal

`PortalInvoices` en `PortalOverview` filteren tijdelijk op `status != 'legacy_void'` en tonen
empty-state-tekst. Migratie van het klantportaal naar Exact API volgt in fase B.

## Maandfacturatie

Maandelijkse termijnen worden via SEPA-incassoschema in Exact afgehandeld (12 termijnen op één
jaarfactuur). Geen auto-facturatie-cron meer nodig.

## Opruim

Te verwijderen in toekomstige opruim-sprint zodra 404-logs aantonen dat er geen aanroepen meer
plaatsvinden naar `generate-invoice` en `export-ubl`:

- `generate-invoice` Edge Function volledig verwijderen
- `invoice_number_seq` sequence droppen
- `generate_invoice_number()` trigger droppen
- `public.invoices` tabel droppen (na archivering)
- `types.ts` regenereert dan automatisch
