# Roadmap
- [x] Tekstcorrecties 13 oktober: 4 CTA-artikelen + 2 AOV-artikelen bijgewerkt, generatorprompt/vergelijkknoppen/FAQ/productlabel/beroepenlijst gecorrigeerd, llms en Zeker opnieuw gegenereerd; browser en build OK; geen publicatie of logica-/prijswijzigingen.
- [ ] Uitgebreide teksttest volledig groen: 19/20 relevante tests slagen; OPGELOST 13 okt: patroon beperkt tot verzekeringscontext, test 4/4 groen, genereer-artikel gedeployed. Standaard testomgeving mist canvas; controle met happy-dom uitgevoerd.
- [x] Besluit A9: 7 beelden en ongebruikte teammodule verwijderd; kantoorbeelden, regressietest 3/3, browsercontrole en build OK; niet gepubliceerd.
- [ ] Volledige testset groen: 811/819 geslaagd; 8 fouten in Exact-bedragen, SEO-titels en WordPress-inventaris wachten op aparte opdracht, buiten deze foto-opdracht gehouden.
- [x] ZP Zaken-faviconset, manifest en prerender-head gecorrigeerd; 5 tests geslaagd en vijf bestanden HTTP 200; ongebruikte placeholder verwijderd; niet gepubliceerd.
- [x] Personenfoto’s lokaal en openbare opslag/database read-only geïnventariseerd, inclusief artikelinhoud/backups, gebruik en teamnamen; rapport en Excel geleverd; geen foto’s gewijzigd. Afgeschermde afbeeldingobjecten alleen metadata, geen visuele beoordeling.
- [x] AI-zichtbaarheid: zorg- en pensioenteksten geneutraliseerd; artikel-JSON-LD, gewijzigde meta en sitemap-lastmod gebruiken updated_at; regressietest toegevoegd; niet gepubliceerd.
- [x] Besluit 12 oktober: gedeelde-dekkingsclaim vervangen in WaaromZpZaken.tsx; overige gevraagde bronnen bevatten geen dergelijke claim. Regressietest toegevoegd, 6 tests geslaagd, desktop/mobiel en build OK; geen bedragen/logica/data gewijzigd, niet gepubliceerd.
- [x] Foutencontrole 12 oktober deel 2: Waarom ZP Zaken FAQ- en statistiekteksten gecorrigeerd; 3 tests geslaagd, preview en FAQPage-schema gecontroleerd, build OK; niet gepubliceerd.
- [x] Foutencontrole 12 oktober: telefoonlinks behouden, artikel-CTA en prijsvermelding gecorrigeerd; 18 tests geslaagd, drie artikeltelefoonlinks en alle genoemde teksten in preview gecontroleerd, mobiele nieuwe tekst past; build OK, niet gepubliceerd.
- [x] Upgrade /scherm: agentkantoor, De stroom, Vandaag, breaking-overlay, browserdemo; privacytests 7/7 en tv-controle 1920x1080/3840x2160 (schaal 2), geen labeloverlap of scroll. Software-rendering is traag; werkelijke tv-framerate niet vastgesteld. Niet gepubliceerd.
- [x] ZP Zaken Live-scherm (/scherm): activiteitentabel, triggers, backfill, scherm-data, 3D-machine en rapportage; getest op 1920x1080. Niet gepubliceerd.
- [x] Foutencontrole 11 oktober: 404-aanroep uitgevoerd en onderschept getest zonder testlog, pakketclaim en artikelzin gecorrigeerd, cyberhulptekst aangepast; build OK, redirecttests 2/2 en Zeker-deeltests 9/9. Bestaande Zeker-brongelijkheid wijkt af door twee eerder toegevoegde landingspagina's; buiten deze tekstcorrecties gelaten. Niet gepubliceerd.
- [x] Adviesclaims vervangen in site, metadata, Zeker, mails en artikelen; uitzonderingen en alle wijzigingen rapporteren, niet publiceren.

- [x] Cyber: centrale prijzen/dekking, alle publieke teksten en Zeker consistent
- [x] Cyber: acceptatievragen, afzonderlijk akkoord met dossierregistratie en Ellen-taak
- [x] Cyber: afzonderlijke contract/factuurregels, vaste looptijd en BAV-opzeg/pauze zonder cybercredit
- [x] Cyber: Mijn ZP en beheer/CRM, handmatige datums en verlengingsvoorwaarden
- [x] Cyber: vijf flowtests, facturatiepreview 51/6943, SEO-behoud en publicatie alleen na geslaagde tests
- [x] Cyber: desktop- en mobiele kliktests, pagina-links/beelden/console en Ads-conversie AW-18497139684 controleren

- [x] Fase 2 tekstaudit: klantteksten, artikelen, certificaatstandaard en opzegpad consistent maken
- [x] Fase 2 controles: activatiefactuurbedrag, 9 oude contractduren, preview 51/6943, tests en auditrapport

- [x] AI-artikelgenerator, categorie-terugval, vijf vervangingen en vier visuele controles (niet publiceren)
- [x] Drie resterende artikelbeelden vervangen: afgehandeld in eerdere beurt, globale pauze verwijderd

- [x] Beheerpunten Ellen (1-6)
- [x] Mijn ZP a) neutrale logintekst, portaltoegang-aanvraag, rate limit
- [x] Mijn ZP b) factuur_email (Say Yup: finance@sayyup.nl), taak Roxy
- [x] Mijn ZP c) knop "Uitnodigen voor Mijn ZP" met voorbeeld
- [x] Mijn ZP d) Exact-facturen via factuur-e-mail, oudere facturen opvragen
- Publiceren: bewust niet uitgevoerd; Boy publiceert zelf.
- [x] Automatische kennisbankafbeeldingen: generator, frontend/SEO, statische bestanden, tests en documentatie (niet gepubliceerd)
- [x] Inloop/uitloop-klantwaarheid overal consistent en /voorwaarden-pagina (niet gepubliceerd)

- [x] Kennisbank samenvoegen (4 bronnen), 2 paren onderscheiden, redirects/sitemap/goedkoopste gecontroleerd

- [x] Boy 12 okt 1: één bron voor aantallen (tel_*-functies, dashboardtegel doel, AI-team live, label gebeurtenissen, test)
- [x] Boy 12 okt 2a: service-aanvraag RPC's afronden/notitie + UI-controle op 0 rijen
- [x] Boy 12 okt 2b: exact-concept-controle schrijft status/nummer terug, cron elk uur werkdag 07-19, knop
- [x] Boy 12 okt 2c: crm_taken dubbelen voorkomen + bestaande samenvoegen
- [x] Boy 12 okt 3: IBAN intern tonen via RPC met audit
- [x] Na akkoord publicatie: exact-concept-controle deployed en één keer read-only gedraaid; geen echte leads/planningregels om af te sluiten; tellingen dashboard en scherm gelijk (eerder gerapporteerd).
- [x] Boy 13 okt A10: Circle8-knop voor collectieve opzeggingen (RPC verwerk_opzegging_circle8, UI, tests)
