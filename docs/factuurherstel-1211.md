# Factuurherstel 12 november 2026

Besluit Boy 12-11 07:38. Site niet gepubliceerd.

## Herstel en controle
- InvoiceText verwijderd uit plannerbuilder en activatie. Rekeningnummer via Exact-layout.
- Vaste kop-/regellijsten in exactFactuurVelden.ts; alle vier SalesInvoices-verzenders weigeren onbekende velden voor verzending, inclusief creditnota's en diagnoseprobes.
- Gerichte test eerst rood op InvoiceText, daarna 64 tests geslaagd. Volledige suite 2713 geslaagd, 1 skipped.
- Deno check van alle vier gewijzigde functies geslaagd (node-modules-dir=none); automatische projectcontrole build OK. Geen afzonderlijke handmatige frontend-typecheck/productiebuild uitgevoerd.
- Alle vier gewijzigde functies uitgerold.
- Productie dryrun HTTP200: 52 factuurregels, 33 creditregels, aanvankelijk alles geblokkeerd/afgehandeld; geen Exact, databasewrites of mails. Na vrijgave: precies 15 facturen, 3167,50; nul credits, wederom zonder effecten.
- Drie waarborgen getest: database laat precies vijf echte runs per NL-dag toe en weigert zes; lege run raakt Exact/mail niet; vast correctiebedrag 60 blijft 60 in plaats van 600 en korting 540 blijft 540. Vandaag twee live runs inclusief de mislukte ochtendrun.
- Alleen GET: volledige inventaris 395 Exact-facturen, per account facturen en boekingen; oude sleutels en exacte omschrijving/bedrag gecontroleerd. Geen bestaande factuur voor de vijftien herstelregels.
- Uitsluitend vijftien vastgelegde oorspronkelijke ids naar tijdelijk, oude fouten/sleutels behouden met factuur_planning_log actie herstel_invoicetext_1211.
- Eén dagrun c38a3da6-697b-4979-9be2-9da60a166551: 15 aangemaakt, nul fouten/tijdelijk/credits/resterend/vervolg. Duur circa 67 seconden. Database bevestigt vijftien unieke Exact-id's.
- Alle vijftien concepten en regeltotalen via Exact GET teruggelezen: status 20, totaal 3167,50. InvoiceNumber is NULL bij elk concept. Geen verwerking uitgevoerd om nummers te verkrijgen.
- Zes extra foutregels van 12 november, samen 324,50, niet gewijzigd; oorspronkelijke opdracht betrof vijftien regels tot en met 11 november.
- Precies één Ellenmelding 2f36207d-78c5-47e6-a829-a356b86d3b51, onderdeel admin, exacte gevraagde actie; teruggelezen en gemaild 08:27:19 UTC. Omschrijving verduidelijkt conceptstatus en zes extra foutregels.

## Nieuwe concepten
Elk factuurnummer: nog niet toegekend door Exact. Referenties blijven beschikbaar in Remarks.

| Klant | Bedrag EUR | Nieuwe Exact-referentie |
|---|---:|---|
| 51Smith | 600,00 | ZPF-E5D242C4 |
| Administratiekantoor R. Ciggaar | 55,00 | ZPF-F9504C35 |
| BES Software Services B.V. | 55,00 | ZPF-7D009437 |
| CodeTestDesignStudio | 150,00 | ZPF-634F8E0F |
| CodeTestDesignStudio | 600,00 | ZPF-F033228B |
| Digital Native Consulting B.V. | 27,50 | ZPF-F7B8D781 |
| DK Interim Management | 55,00 | ZPF-F93958E2 |
| Empatho B.V. | 600,00 | ZPF-301FA556 |
| GPM Consultancy B.V. | 55,00 | ZPF-EC6AE272 |
| Inclusief verzuimregie | 55,00 | ZPF-4ACA94BA |
| KLC Consulting | 55,00 | ZPF-33256DD7 |
| Roger Isaac Consulting | 150,00 | ZPF-C5ECEAF5 |
| Roger Isaac Consulting | 600,00 | ZPF-A7AA2E4F |
| Scripting4U | 55,00 | ZPF-983909C3 |
| VG Hospitality Services | 55,00 | ZPF-2001007A |

Geen klantmailverzending aangeroepen; bestaande interne planner-/Exact-boekingsmeldingen blijven volgens hun bestaande route werken. Geen prijzen, SEPA of sitepagina's gewijzigd.