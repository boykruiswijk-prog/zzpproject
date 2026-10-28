# Kwaliteitscontrole 28 oktober 2026

## Resultaat
Alleen de gevraagde tekstcorrecties uitgevoerd. Niet gepubliceerd en geen functies gedeployed. Prijzen, bedragen, facturatie, SEPA, mails, CYBER_AKKOORD, certificaten en Exact zijn niet gewijzigd. Geen gegevens verwijderd.

De twee artikelrijen zijn direct in de gedeelde artikelbron bijgewerkt, zoals gevraagd. Daardoor kan een dynamisch gelezen artikel de nieuwe tekst al tonen zonder websitepublicatie. De websitebestanden en Zeker-functie wachten op publicatie/deployment door Boy.

## Gewijzigde bestanden
- `src/config/cyberPubliek.ts`: één publieke combinatie van dekking en hulp met tussenliggende punt; de contractuele bron blijft byte-gelijk.
- `src/data/faqItems.ts`: cyberpunt en de drie algemene FAQ-correcties; de FAQ-pagina, FAQ-schema en generators gebruiken deze bron.
- `src/pages/Starters.tsx`, `src/pages/ZzpVerzekeringICT.tsx`, `src/pages/BavZzpVergelijken.tsx`: de gedeelde cybercombinatie gebruikt, geen losse punctuatiereparaties.
- `src/pages/BavZzp.tsx`: nieuwe inleidende artikelzin, link ongewijzigd.
- `src/pages/ZzpVerzekeringConsultant.tsx`: beide aangewezen zinnen.
- `src/pages/Beroepsaansprakelijkheidsverzekering.tsx`: dezelfde oude polisvraag ook hier vervangen, vanwege de gevraagde brede regressiecontrole.
- `src/pages/ZzpVerzekeringInterimManager.tsx`, `src/pages/ZzpVerzekeringHR.tsx`: ZP Zaken beoordeelt de aanvraag; zichtbaar antwoord en schema komen uit dezelfde array.
- `src/pages/ZzpVerzekeringCoach.tsx`: aangewezen aansprakelijkheidszin.
- `supabase/functions/_shared/zekerKennis.generated.ts`: opnieuw gegenereerd uit de bron; geen beroeps-FAQ-kopieën aangetroffen.
- `public/llms-full.txt`: uitsluitend de vier betreffende FAQ-passages bijgewerkt. `public/llms.txt` was al correct en is niet gewijzigd. De llms-generator neemt de gecorrigeerde FAQ-bron automatisch over; `scripts/llmsTxt.ts` is uiteindelijk ongewijzigd gehouden.
- `src/test/kwaliteit2810.test.ts`: negen afzonderlijke controles op alle opgegeven oude formuleringen, in src, beide llms-bestanden, generatoruitvoer en Zeker-kennis.
- `AGENTS.md`, `roadmap.md`: gedeelde-bronafspraak en taakstatus.
- `docs/kwaliteit-2810.md`: dit rapport.

In nl/en/de/fr zijn geen kopieën van de bedoelde cyberzin gevonden; geen vertaalbestanden gewijzigd.

## Artikelrijen
- `bav-ict-zzp-risicos`, id `64e8f357-2390-48c0-a357-88b74bae77f1`: inclusieve-prijstekst toegevoegd zonder bedragen te wijzigen, cybervoorwaarden-telefoon gelinkt.
- `cyberverzekering-zzp`, id `2dcbeb83-9802-4bdc-ad31-c68468c5eddf`: drie ontbrekende zinnen over niet pauzeren toegevoegd; voorwaardenopsomming bevat nu de volledige vaste tekst; resterende ongelinkte telefoonverwijzing gelinkt. Bestaande telefoonlinks behouden.
- Beide `updated_at`: `2026-10-28 06:36:12.777839+00`.
- Volledige inhoud teruggelezen en vergeleken met uitsluitend de aangewezen vervangingen. Zes volledige cyberopzegpassages in het cyberartikel; nul onvolledige passages. De tekstweergave van de oorspronkelijke query laat de afsluitende newline weg, de daadwerkelijke artikelupdate bewaart die.

## Controles
- 12 gerichte testbestanden: **84 geslaagd, 1 overgeslagen, 0 mislukt**. Inclusief alle bestaande kwaliteit2310 t/m kwaliteit2710, kwaliteit2810, Zeker, beroepspaginaTeksten, hiscoxAcceptatie, cyberEuropaE7, cyberSpoed2610 en cyberInternBundle.
- Overgeslagen: bestaande productiechunk-scan, geen lokaal productie-manifest beschikbaar.
- Preview: vier gewijzigde FAQ-antwoorden én schema gecontroleerd; BAV-link, consultant, coach, algemene BAV-pagina en algemene FAQ-schema gecontroleerd. Geen runtimefouten.
- Automatische bouwcontrole: build OK.
- Eén gewone melding aan Ellen toegevoegd; geen klantmail verstuurd.

## Andere klaarstaande wijzigingen / livecontrole
Live website op 28 oktober gecontroleerd: hoofdasset `/assets/index-4xKn3yEq.js`, dashboardasset `Dashboard-Bk8RG5zI.js`, HTTP 200.

De eerdere werkzaamheden zijn inmiddels herkenbaar in de gepubliceerde bestanden: ARR (`arr_overzicht`), NPS (`nps_overzicht` en `/nps` HTTP 200), OpenAI pagina-events (`page_viewed`), gedeelde browser/server-ID (`bav_lead_`), latere cyberaanvragen, nieuwe BAV-intro en ICT-kop. Ze zijn dus niet meer als ongepubliceerde frontendonderdelen aan te merken. Relevante broncommits: ARR `ab39c9d4` / afronding `dfb5c1d8`; NPS `949a69de` en vervolg tot `5c3d99ee`; OpenAI tracking `47daf2af`; reviewtekst `b9f033d5` / afronding `3335c634` (functie eerder gedeployed, actieve mailtekst niet opnieuw getest om verzending te vermijden).

De exacte laatst gepubliceerde commit is niet beschikbaar in de publicatie-informatie of live metadata. Daarom is geen volledige commit-voor-commit gelijkheid bewezen. Op basis van herkenningspunten zijn geen andere concrete ongepubliceerde frontendonderdelen vastgesteld. Bekende open opdrachten zijn niet hetzelfde als klaarstaande publicatie: herinnering voor afgehaakte aanvragen heeft alleen voorbeeldteksten en wacht op akkoord; NPS aanzetten/cron wacht op akkoord; verschillende aangemelde controles wachten op geldige MFA.

Nieuwe teksten van deze controle ontbreken nog in de live bestanden, zoals bedoeld. De eerste tekstcommit is `76005617`, afgeleide bronnen `7edcc53d`, vergelijkingspagina `a82d4528`; de technische notities en dit rapport krijgen automatisch aanvullende commits. Niet publiceren voordat Boy dit heeft gecontroleerd.