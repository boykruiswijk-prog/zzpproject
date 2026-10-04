# Roadmap

- [x] Centrale interne meldingsontvangers, afzonderlijke logging, alarm en routetests
- [x] Boy admin maken; admin-only team, facturatieschakelaars, Exact en integraties afdwingen
- [x] Admin-only activiteitenlog samenstellen en exports/downloads auditen
- [x] Beheermenu groeperen en oude beheer-URL's behouden
- [x] Rechtenmatrix en verzekering-rol vóór/na verifiëren

- [x] Mobiele admin: menu, compacte klant-/leadlijsten, scrollbare tabellen en passende dialogen
- [x] Mobiele admin: visuele controle op 390, 768 en 1280 px

- [x] Part A: H13/H14/M1/M2/M3 uitvoeren volgens goedgekeurd plan
- [x] B1: alle gedeelde Exact-token/GL-functies controleren en read-only smoke-testen
- [x] B2: één Exact-schakelaar per domein en beheerweergave aanpassen
- [x] B3: drie diagnosefuncties beperken tot admin/supervisor
- [x] B4: Integraties-knoppen/toegang aanpassen en exact-status toevoegen
- [x] B5: Exact-factuurstatus synchroniseren en incassobatchtaak loggen
- [x] B6: screening BankAccount-veld gebruiken
- [x] Urgent: division-check op geconfigureerde administratie, CurrentDivision alleen informatief
- [x] Urgent: alarmthrottle per genormaliseerde foutboodschap en echte keepalive-bewijstest
- [x] Deploy, daarna rg, daarna veilige tests en typecheck
- [x] Part A: BAV-AVB bevestigingsscherm na succesvolle gemockte inzending
- [x] Part B: Lovable security scan en backend-linter vóór fixes inventariseren
- [x] Part B: echte kritieke/hoge bevindingen herstellen zonder bestaande toegang te breken
- [x] Part B: regressietests, herscan en typecheck uitvoeren

- [x] T1: verzekering-rol in dagelijkse teamfuncties en AuthContext herstellen
- [x] T1: activeringsreden, sector-naar-branche en SEPA-zijbalk herstellen
- [x] T1: alleen lead db612f38 branche backfillen; tests en breedtecontrole uitvoeren

- [x] Integraties: Exact-statuskaart op echte gezondheid, juiste refreshdatum, Amsterdam-dagtelling, updated_at-trigger
- [x] Adressen: PDOK-suggestie (NL) in BAV/online-aanvraag/screening, postcode "1234 AB", CSP-check
- [x] Adressen: server-fallback hoofdletter straat/plaats vóór legBewijsVast; unit test + Playwright (gemockt PDOK)
- [x] Go-live: authentieke teamfoto's Gert-Jan/Roxy en Sandra/Noah of initialen; bronnen en rollabels rapporteren
- [x] Go-live: Boy-portret bij citaten en foutieve quote-attributies herstellen
- [x] Go-live: /voorwaarden en /polisvoorwaarden naar branchevoorwaarden; redirects en screenshots controleren
- [x] Publieke deelnemersaantallen, doelen en voortgangsbalken bij Collectief verwijderen
- [x] Eerlijke commerciële collectieftekst in NL/EN/DE/FR toevoegen
- [x] Collectieve aanmeldtellingen alleen voor admin/supervisor zichtbaar houden
- [x] Collectiefpagina en menu visueel controleren op 1280 en 390 px
- [x] Build, tests en typecontrole uitvoeren

- [x] Zwevende telefoon- en WhatsApp-knoppen zonder overlap, inclusief mobiele veilige ondermarge
- [x] Kopbalk met korte NIEUW-badge en éénregelige onderdelen op 1280–1920 px
- [x] Screenshots op 390, 1280 en 1440 px controleren
- [x] Build, tests en typecontrole uitvoeren; niet publiceren

## Zeker (chatassistent)
- [x] Eval 25+ vragen, prompt verbeteren tot alles slaagt
- [x] Bypass alleen rate limit; tonen dat zonder secret normale limiet geldt
- [x] Eindtest terugbelverzoek (is_test, preview-mail)
- [x] Screenshots 390/1280/1440 (open, dicht, cookiebanner, formulier)
- [x] Build, vitest, typecheck, deno check, security-scan, bundelgrootte

- [x] AFAS-klantcontracten inlezen in CRM (klant_contracten, Klanten & contracten-schermen, reconciliatie); facturatie blijft uit
- [ ] Fase 1 Exact: gebouwd; abonnementen lezen geblokkeerd door Exact-recht (403) — wacht op Exact-toegang
- [ ] Fase 2 Exact-schrijfwachtrij: wacht op akkoord Boy

- [x] Fase 2: datamodel planner, artikelmapping (onbevestigd), conflicten, doorrol-RPC met preview
- [x] Fase 2: alleen-lezen controle Exact (artikelen, 7 dagen facturen, Remarks-filter, PDF-route)
- [ ] Fase 2: doorrol_startstand(false) — geblokkeerd: controle vond geen facturen voor de 36 regels
- [x] Fase 2: factuur-planner (schakelaar UIT), cron 06:00, beheerscherm, activatie → contractregel, maandcron weg
- [x] Fase 2: Mijn ZP Facturen (verwerkt, vanaf 17-10-2026, geen betaalstatus, PDF via Exact-documenten)
- [ ] Fase 2: hervat-factuur in polis-lifecycle via planningstabel laten lopen — wacht op akkoord
- [x] Boy-vervolg: AFAS uit UI, banner weg, dashboard één bron (dashboard_tellers), CRM-doorklik, opzegkoppeling + "Opzegging verwerken"
- [x] Creditnota bij opzegging (concept, gekoppeld aan factuurnummer, onder hoofdschakelaar, Mijn ZP)
- [x] Certificaatnummers koppelen aan klanten (klant_certificaten, klantdetail, zoeken/filter, opzegkoppeling, generator)
- [ ] Tweede certificatenlijst partners (Circle8, De Staffing Groep, HeadFirst) — wacht op besluit Boy
- [x] Urgent: nieuwe 1200×630-deelafbeelding, cachebrekende metadata en prerender-controle

## SEO-sprint 1 (01-10-2026)
- [x] Volledige SSR-prerender, woordenscript (scripts/check-prerender-woorden.py)
- [x] Soft-404 noindex, NotFound NL, stubs noindex + artikel-slug-stubs
- [x] Artikelen: zp-zaken → nieuwe slug, links hersteld, linkcheck-test
- [x] Categorieën (5), /kennisbank/verzekeringen, CTA's, Lees meer, /diensten-links
- [x] E-E-A-T-datum, Hiscox, claims, meta, sitemap, taal, schema's
- [ ] Wacht op Boy: foundingDate, persoon als auteur, slug "goedkoopste", claim "goedkoopste van Nederland" in welke-verzekeringen-zzp, tekst nieuw AVB-artikel
