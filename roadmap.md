# Roadmap
- [x] BetterLinks 19 oktober: alle 37 specifieke korte links toegevoegd aan frontend/serverlijst; 301/CSV via bestaande generators, vijf routes en PDF bevestigd; 92/92 gerichte tests, 436/438 inventaris (twee bestaande fouten buiten scope), drie preview-eindadressen bevestigd; één melding voor Ellen, niet gepubliceerd.
- [x] 19 oktober spoed: BOOT_ERROR door SDK 2.45.4 zonder cors-export hersteld met expliciete SDK/CORS-versie; machine-toegang alleen via echte configured secret/service-token op beide mailfuncties, menselijke MFA/rollen behouden; admincontrole vóór mutaties en MFA-terugkeer. 107/107 tests groen, droge run met mocks zou verzenden zonder writes/fetch; beide functies gedeployed en live 401/403 zonder bootfout. Eén onbevestigde stop vandaag, nul incassoroyementen; niets opnieuw verzonden. Eén melding voor Ellen, website niet gepubliceerd.
- [ ] 19 oktober spoed: volledige live droge-run met geautoriseerde sessie wacht op aal2; geminte eigen sessie krijgt terecht mfa_required. Bestaande MFA-instelscherm verschijnt maar account-enrollment meldt fout; geen factorwijziging uitgevoerd. Machine-/aal2-verzendpad alleen met mocks geverifieerd.
- [x] 19 oktober: 24 oudere teamfuncties krijgen centrale MFA-controle met behoud rolrechten en afzonderlijke klant-/cron-/secretpaden; inventaristest voor alle functies met 28 expliciete uitzonderingen. 115/115 gerichte tests groen; volledige set 1213 geslaagd, 5 bestaande fouten in Exact/WordPress/rootredirects, 1 overgeslagen; automatische build OK. Geen publicatie/deploy, bedrijfsdata-/prijs-/facturatie-/SEPA-/klantmailinhoudwijzigingen of operationele functieaanroepen.
- [ ] 19 oktober: echte supervisor-dashboardcontrole met MFA wacht op een geldige aal2-sessie; geminte eigen sessie heeft geen aal2 en browser toont MFA-instelscherm. Dashboardpoort aal2/aal1/uitgelogd en dashboardtellers wel getest met mocks.
- [x] 18 oktober: twee exacte F5-zinnen en updated_at bijgewerkt, teruggelezen en zichtbaar gecontroleerd; 60 gepubliceerde artikelen zonder ondernemersplein-links. Root-artikelredirects uit dezelfde sitemaplijst: 23 nieuwe paden/46 regels, bestaande routes/redirects en /tv beschermd; CSV noodzakelijk bijgewerkt. 67/67 gerichte tests, uitgebreid 503/505 met twee bestaande WordPress-inventarisfouten buiten scope; automatische bouwcontrole OK. Geen publicatie, mails of overige datawijziging.
- [x] Interne cyberbron gescheiden, lazy admin-import en manifest/importgraafscan toegevoegd; vijf A16-301's plus CSV gegenereerd, 51 tests geslaagd, vijf exacte browser-eindadressen bevestigd, automatische controle build OK. Evi, /tv, klantenprijzen/teksten/mails/data ongemoeid; geen publicatie/deploy.
- [ ] Werkelijke productiechunk-scan: dist/assets en .vite/manifest.json zijn niet beschikbaar in deze sandbox; preview-manifest HTTP 401. Scan draait automatisch bij vite build en schrijft dist/cyber-bundle-audit.json met exacte chunklijst. Productietest nu 1 overgeslagen, geen scanresultaat claimen.
- [x] Cyber-versiecorrectie: versie/herkenning terug naar 2026-10-08 met behoud nieuwe teksten; read-only 0 leads en 0 contracten met 2026-10-16 (ook totaal); 68/68 gerichte tests, build OK en dezelfde zeven functies opnieuw gedeployed zonder aanroep. Geen databasewijziging, mail, Exact of publicatie.
- [x] E-aanvulling 2: uniforme cybertekst, versie 2026-10-16 met behoud herkenning 2026-10-08; 68/68 gerichte tests (node wegens ontbrekende canvas), build OK, publieke browsercontrole zonder runtimefouten; zeven betrokken functies gedeployed zonder aanroep. Geen records/documenten, mail, Exact-aanroep of frontendpublicatie.
- [x] Cyber-versieafhankelijke databasefuncties: incompatibele versie teruggedraaid naar 2026-10-08, zonder databasewijziging; read-only geen rijen met 2026-10-16 gevonden.
- [x] Kwaliteitscontrole 16 oktober: publieke opzeg-/cyberteksten en acht bestaande artikelrijen gecorrigeerd; drie artikeltelefoonlinks en certificaatbenaming bevestigd. Zeker/llms/sitemap vernieuwd; 65/65 gerichte tests, volledig 1104/1106 (twee bestaande Exact-creditnotafouten buiten scope); vijf publieke pagina's browsercontrole zonder runtimefouten, build OK. Beschermde teksten bewaard; geen publicatie, deploy, inzending, Exact-writes of klantmails.
- [x] F7 20:18: productie-404 zolang vlag uit, preview zichtbaar/noindex, verborgen prerender overgeslagen; 79/79 gerichte tests, browser met lokaal nagebootste productie-/previewhosts bevestigd, automatische build OK. Geen publicatie/deploy/inzending.
- [x] F7 akkoord 18:35 uitgevoerd: additief conceptveld zonder terugvulling, intern label/bron, Hiscox alleen BAV-blok. Geen inzending, klantmail, wijzigingsmelding of publicatie.
- [x] F7 verborgen pensioenpagina: volledige statische render 77.739 bytes, noindex,nofollow, tien FAQ’s en drie risicowaarschuwingen; desktop/360px zonder horizontale scroll of consolefouten. 18/18 nieuwe tests en 67/67 gerichte tests; suite 1088/1090, twee bestaande Exact-creditnotafouten buiten scope. Automatische build OK.
- [x] Spoedfavicon 15 oktober: complete versiegebonden ZP-set en tien HTTP-200-paden gecontroleerd; 10/10 icoontests, volledige suite via happy-dom 1069/1071 (twee bestaande Exact-creditnotafouten, financiële logica buiten scope); automatische build OK. Publicatie aangevraagd, geen wijzigingsmelding.
- [x] Boy 15 oktober: Ads-labels beveiligd, betaalde 90-dagenherkomst en boolean marketingtoestemming door client/server; permanent agentkantoor en negen rechterpanelen getest op 1920×1080; 22/22 gerichte tests, build OK, twee formulierfuncties gedeployed. Website niet gepubliceerd, geen aanvragen of klantmails.
- [ ] Volledige testsuite voor 15 oktober: 1006/1008 groen; twee bestaande Exact-creditnotatests blokkeren volledig groen. Exact wijzigen is expliciet uitgesloten, dus aparte toestemming nodig.
- [x] Tekstcontrole 15 oktober: zes tekstpunten en drie artikelrijen gecorrigeerd; sitemap/llms/Zeker vernieuwd; browser/FAQ-schema en build OK; 82/86 tests groen, vier bestaande SEO-titelafwijkingen buiten opdracht. Niet gepubliceerd, geen klantmails.
- [x] Boy 14 oktober: uitsluitend starterpremietekst op betaalwijze afgestemd; maand/jaar/cyber getest, 18/18 tests groen; process-bav-wizard gedeployed; geen mails of wijzigingsmelding.
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
- [x] Boy 13 okt D4: ingangsdatum vroegst dag na aanvraag (formulieren, server, trigger, RPC, activeren, waarschuwing, tests, wijzigingsmelding)
- [x] Boy 13 okt A12: KVK API veilig aanzetten (helper, uitschakelaar, cache, limieten, knop beheer, startersoordeel, tests, rooktest, deploy+publiceer, melding Ellen)
- [x] Boy 13 okt A14: nooit stil een nieuw certificaatnummer, voorstel vooraf bij lead, BAV-nummer aanpassen op certificaat

- [x] F5: KvK-ondernemerspleinzin verwijderd uit artikel alles-over-een-zzp-factuur (17-10)
- [x] A16 17-10: 4 nieuwe 301s uit 404-log; /src/assets/team-walking.webp niet in code
- [x] F1 18-10: aanbiedersnamen neutraal in vergelijking, partnerteksten/logo's en zeven artikelen; llms bijgewerkt, gepubliceerde artikelen teruggelezen zonder namen; 91 gerichte tests geslaagd in node-omgeving, desktop/360px gecontroleerd en build OK; niet gepubliceerd, geen mails of logica gewijzigd.
- [x] Boy 19-10: snelle start op beroeps-/BAV-pagina's, soepeler KvK-veld, conversie aanvraag_gestart (GA4/Ads/UET); niet gepubliceerd
- [x] F7-aanvulling 19-10: Evi-pagina conversie (rekenhulp in hero, deadline, sticky balk, vertrouwen, korter formulier, event evi_interesse_verstuurd), niet gepubliceerd
- [x] Evi-logo geplaatst (md5 klopt), contrast gecontroleerd
