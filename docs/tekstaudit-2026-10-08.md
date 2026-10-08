# Tekstaudit 8 oktober 2026 (fase 1: alleen inventarisatie)

Niets is aangepast. Doorzocht: src/ (zonder beheer en tests), supabase/functions (mails, PDF, Zeker-kennis), index.html, public/llms.txt, scripts/llmsTxt.ts, gepubliceerde artikelen (tabel `articles`, `published_at` gevuld) en `facturatie_config`.
Regelnummers kloppen met de code van 8-10-2026. Waar staat "onbekend, besluit Boy nodig", volgt de waarheid niet uit code of data.

---

## 1. Opzegbaarheid

**a. Varianten**
- "Dagelijks opzegbaar": bavPakketten.ts:18/36/54, nl.json:132 (`bavUsps`), WaaromZpZaken.tsx:43-45/52/200, alle beroepspagina's (Coach:29, Marketing:29, Finance:29, HR:29, Consultant:15/29, InterimManager:15/29), seoRoutes.ts:41/45/62/67/405/432, ArtikelDetail.tsx:121, CombiPackageSection.tsx:28, SavingsCalculator.tsx:65, BavZzpVergelijken.tsx:181, Starters.tsx:26, offerte-mail _shared/offerte.ts:39 ("Looptijd: Dagelijks opzegbaar"), llmsTxt.ts:39, Zeker-kennis zekerKennis.generated.ts:21/42/66/85/297/347/357, en artikelen (bav-afsluiten-als-zzper, opdrachtgever-eist-bav, verschil-bav-avb-zzp, zelfstandigenwet-*, wat-kosten-verzekeringen-voor-zzp-ers, zzp-verzekering-kosten-2026 en andere).
- "Onze verzekeringen zijn dagelijks opzegbaar. Geen jaarcontract, geen verborgen voorwaarden.": faqItems.ts:51.
- "Geen minimale looptijd. Geen opzegtermijn. Jij bepaalt wanneer je stopt.": SavingsCalculator.tsx:126.
- "Per dag opzegbaar, ten vroegste vanaf vandaag. Wij verwerken je opzegging binnen 24 uur": mijn-zp/Opzeggen.tsx:101/103/180.
- "Je bent dagelijks opzegbaar maar nooit automatisch gestopt": waaromFaqs.ts:33.
- **Certificaat-PDF**, standaardtekst als `policy.contract_duration` leeg is: "12 maanden doorlopend, met stilzwijgende verlenging voor telkens 12 maanden, per direct opzegbaar.": generate-certificate/index.ts:596.
- Portaal: "Geen jaarcontract-lock-in: je ontvangt een creditnota voor de resterende dagen van je polisjaar": PolicyLifecycleActions.tsx:298.
- Portaal: "Pauzeren of opzeggen kan voor deze polis niet online": PolicyLifecycleActions.tsx:75 (voor bepaalde polissen).

**b. TEGENSTRIJDIG: ja.** Het certificaat noemt 12 maanden met stilzwijgende verlenging. De rest van de site zegt "dagelijks" en "geen jaarcontract". Ook "per direct" (certificaat) en "per dag, verwerkt binnen 24 uur" (Mijn ZP) zijn verschillende formuleringen.

**c. Wat de code doet**
- Mijn ZP-opzegformulier: einddatum vandaag tot 180 dagen vooruit (opzegValidatie.ts).
- `bepaal_opzegging_koppeling` koppelt de opzegging en `verwerk_opzegging` past het contract aan. Een contract eindigt nooit automatisch.
- Er is in de code geen opzegtermijn en geen minimale looptijd.
- Of de echte Hiscox-polis een contractduur van 12 maanden met verlenging heeft: onbekend, besluit Boy nodig.

## 2. Looptijd en contractduur

**a. Varianten**
- Certificaat: "12 maanden doorlopend, met stilzwijgende verlenging voor telkens 12 maanden" (generate-certificate:596).
- "loopt door totdat je opzegt": faqItems.ts:53 en Zeker:357.
- "Geen minimale looptijd": SavingsCalculator.tsx:126.
- Exact-factuurregel bij maandpakket: "Betaling: 12 termijnen van € 55 via SEPA-incasso", met factuurbedrag 660: lead-to-exact-activate/index.ts:108.
- Jaarpakket: "Betaling: jaarlijks vooraf via SEPA-incasso" (lead-to-exact-activate:113).

**b. TEGENSTRIJDIG: ja.** "12 termijnen van € 55" en een factuur van € 660 suggereren een jaarverplichting bij maandbetaling. Dat botst met "geen jaarcontract" en "geen minimale looptijd".

**c. Wat de code doet**
- Maandcontracten starten elke maand een periode, jaarcontracten één keer per 12 maanden (klantContracten.ts:70).
- Jaarpolis: polis_einddatum = ingangsdatum + 1 jaar (lead-to-exact-activate:273).
- Of de klant contractueel 12 termijnen verschuldigd is: onbekend, besluit Boy nodig.

## 3. Betaling en terugbetaling bij opzeggen

**a. Varianten**
- Wizard: "Vul je IBAN in voor de automatische incasso" en "Ik ga akkoord met automatische incasso voor de premiebetalingen" (nl.json:122/124); "Doorlopende SEPA-machtiging" (BAVApplicationModule.tsx:1012). SEPA-tekst: doorlopend of eenmalig, terugboeken binnen 8 weken (sepaMachtiging.ts:96-102).
- Portaal, opzeggen: "je ontvangt een creditnota voor de resterende dagen van je polisjaar" en "Ik begrijp dat mijn polis per vandaag eindigt en dat er een creditnota wordt aangemaakt voor de resterende dagen van mijn polisjaar" (PolicyLifecycleActions.tsx:298/351).
- Portaal, pauzeren: creditnota voor resterende dagen (PolicyLifecycleActions.tsx:191/238). Hervatten: nieuwe factuur voor resterende dagen (:257).
- Pauze-preview: "Bij een maandpolis wordt de lopende maand niet terugbetaald; vanaf de pauze worden geen nieuwe maandfacturen gemaakt." (calculate-pauze-preview:68).
- Beëindigingsmail team: "Is er na die datum al iets gefactureerd, dan ontvang je daarvoor een creditnota." (crm-beeindiging-bevestiging:42).
- Op de openbare site (prijsblokken, FAQ, /starters, wizard) staat nergens wat er gebeurt met een vooruitbetaalde jaarpremie bij opzeggen.

**b. TEGENSTRIJDIG: deels.**
- Portaal en beëindigingsmail zeggen naar rato terug. De pauze-preview zegt dat de lopende maand bij een maandpolis niet terugkomt.
- De nieuwe facturatie crediteert ook binnen een al gefactureerde maand (zie c).
- De openbare site zegt niets over terugbetaling.

**c. Wat de code doet**
- `facturatie_config`: facturatie_actief = true, opzeg_credits_actief = true, verwerk_termijn 5 werkdagen.
- `plan_opzeg_credit` (vanaf facturatiegrens 13-10-2026) maakt een creditnota van einddatum + 1 tot het einde van de laatst gefactureerde periode, voor maand- én jaarcontracten. Dat geldt ook voor perioden die in het oude systeem zijn gefactureerd (bron "oud_systeem").
- De creditnota blijft een concept, met een blokkade als de artikelmapping of Exact-koppeling ontbreekt.
- polis-lifecycle (oud pad): maandpolis geen creditnota, jaarpolis creditnota voor de resterende dagen.
- Welk van de twee voor klanten geldt: onbekend, besluit Boy nodig.

## 4. Prijzen

**a. Varianten**
- € 55 p/m, € 600 p/j, € 750 p/j met Cyber: bavPakketten.ts (enige bron), "inclusief kosten en assurantiebelasting" (bavPakketten.ts:19/37/55, llmsTxt.ts:36/80, artikelen).
- Starter: € 45 p/m of € 495 p/j de eerste 12 maanden, daarna € 55 of € 600 (starterTarief.ts:15, seoRoutes.ts:423/426, Starters.tsx:24, artikelen starten-als-zzper en zelfstandigenwet-verzekering-zzp).
- "Bespaar €40" (nl.json:101; ook en/de). Werkelijk verschil: 12 × € 55 = € 660 tegenover € 600, dus € 60.
- Label "Goedkoopste premie" en "Voordeligste optie" op het jaarpakket (bavPakketten.ts:26/35, WaaromZpZaken.tsx:44). Artikel-slug zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb.
- index.html:168: priceRange "€55 - €750".
- Andere bedragen, geen botsing: Screening € 49, Pensioen "vanaf €50", artikel uurtarief-berekenen (€49/€59 zijn uurtarieven), cyberverzekering-zzp "€ 50.000".
- Het artikel wat-kosten-verzekeringen-voor-zzp-ers noemt "€ 600 in plaats van 12 keer € 55". Dat klopt.

**b. TEGENSTRIJDIG: ja.** "Bespaar €40" moet € 60 zijn volgens de prijzen. Verder zijn de prijzen overal gelijk.

**c. Wat de code doet:** de prijzen komen uit bavPakketten.ts. De starterregels staan in contract_bedrag_voor_periode (starter tot einddatum, daarna het gewone bedrag).

## 5. Eigen risico

**a. Varianten**
- "Geen eigen risico" en "€0 eigen risico": nl.json:132, WaaromZpZaken.tsx:43-45/200/227, alle beroepspagina's, seoRoutes, ArtikelDetail.tsx:121, BavZzpVergelijken.tsx:179, llmsTxt.ts:39, Zeker, veel artikelen.
- Certificaat-PDF, standaardtekst: "Eigen risico: ZP Zaken draagt de kosten voor het eigen risico." (generate-certificate:514-515).
- Portaal toont het veld "Eigen risico" uit de polis (PortalPolicy.tsx:93).

**b. TEGENSTRIJDIG: ja, in de formulering.** De site zegt dat er geen eigen risico is. Het certificaat zegt dat er wel een eigen risico is, maar dat ZP Zaken het betaalt.

**c. Wat de code doet:** onbekend, besluit Boy nodig. De hoogte van het eigen risico in de Hiscox-polis staat niet in code of data.

## 6. Verzekerde bedragen

**a. Varianten**
- Data (bavPakketten.ts): BAV € 5 mln per gebeurtenis en € 15 mln per jaar; AVB € 2,5 mln per gebeurtenis en € 5 mln per jaar; Cyber € 50.000 per schade en € 5 mln per jaar.
- "per gebeurtenis": CombiPackageSection.tsx:84/93, PortalPolicy.tsx:77/85, process-bav-wizard:35/43, send-offerte:70, llmsTxt.ts:82 (AVB), artikelen.
- "per aanspraak": certificaat (BAV én AVB, generate-certificate:450/478), "per verzekeringsjaar" (:459/487), llmsTxt.ts:81 (BAV), Zeker zeker.ts:90 (BAV), ZzpVerzekeringICT.tsx:34 (BAV en AVB).
- Cyber: "Cyber tot €5.000.000 per jaar" (WaaromZpZaken.tsx:45, process-bav-wizard:51), zonder het bedrag per schade van € 50.000. WaaromZpZaken.tsx:43-45 toont bij alle pakketten alleen "€5.000.000 / €15.000.000" (BAV).
- Offerteformulier: keuze "€2.500.000" en andere bedragen (OnlineAanvraagDialog.tsx:467).

**b. TEGENSTRIJDIG: ja.**
- "Per aanspraak" en "per gebeurtenis" worden door elkaar gebruikt, ook voor de AVB.
- Bij Cyber ontbreekt op meerdere plekken het bedrag per schade (€ 50.000).

**c. Wat de code doet:** de bedragen zijn overal gelijk. Welke term (aanspraak of gebeurtenis) volgens de polisvoorwaarden juist is per dekking: onbekend, besluit Boy nodig.

## 7. Ingangsdatum en snelheid

**a. Varianten**
- "Direct gedekt": nl.json:132, WaaromZpZaken.tsx:200.
- "Binnen 24 uur verzekerd, met certificaat als bewijs": llmsTxt.ts:40. "Binnen 24 uur geregeld en certificaat in je mailbox": bavVergelijking.ts:144 en artikelen (opdrachtgever-eist-bav, starten-als-zzper, wat-kosten-…, zp-zaken-zorgeloos-…).
- "online geregeld binnen 24 uur": seoRoutes.ts:386/396/414/450/459/469.
- "Je krijgt binnen 24 uur bericht. Na akkoord ben je direct verzekerd": send-notification:117/119.
- "binnen 1 werkdag": meerdere bevestigingen en artikelen.
- Ingangsdatum "maximaal 6 maanden vooruit": faqItems.ts:53.
- Terugwerkende kracht: de wizard zegt "Neem contact op als je met terugwerkende kracht wilt verzekeren" (BAVApplicationModule.tsx:206/733). De server zegt "Een verzekering kan niet met terugwerkende kracht worden afgesloten" (process-bav-wizard:190).

**b. TEGENSTRIJDIG: ja.**
- "Direct gedekt", "binnen 24 uur" en "binnen 1 werkdag" lopen door elkaar.
- Terugwerkende kracht: "neem contact op" tegenover "kan niet".
- Zorg en bouw krijgen intern handmatige acceptatie, terwijl de site daar ook "binnen 24 uur" en "direct" belooft (seoRoutes.ts:459/469).

**c. Wat de code doet**
- Een aanvraag wordt een lead. Het certificaat komt pas na activatie door het team (lead-to-exact-activate en generate-certificate). Er is geen automatische activatie.
- Zorg en bouw vragen vóór activatie een bevestigde handmatige acceptatie (sectorRegels.ts).
- Het startertarief vraagt een goedkeuring, behalve als de KVK-datum via de KVK-koppeling is bevestigd.
- Of er dekking is vanaf de ingangsdatum, ook als de activatie later is: onbekend, besluit Boy nodig.

## 8. Inloop, uitloop en nadekking

**a. Varianten**
- "Inloop- en uitloopdekking": nl.json:514 (`runOffCoverage`).
- "Jouw uitlooprisico blijft tijdens de pauze gewoon behouden": Pauzeren.tsx:24/26/101, faqItems.ts:38, Zeker:317.
- Bouwpagina: "Dat hangt af van de nawerking- en nadekkingsclausule in je polis" (ZzpVerzekeringBouw.tsx:32/95).
- Uitleg, geen claim over ZP Zaken: BavZzpVergelijken.tsx:107, bavVergelijking.ts:143.

**b. TEGENSTRIJDIG: mogelijk.** De site noemt inloop- en uitloopdekking als kenmerk, maar de bouwpagina zegt dat het van de polis afhangt.

**c. Wat de code doet:** niets. Inloop en uitloop worden in de code niet geregeld. Onbekend, besluit Boy nodig.

## 9. Doelgroep en acceptatie

**a. Varianten**
- Verzekeraar: "via Hiscox" (seoRoutes, artikelen).
- Zorg en bouw krijgen intern handmatige acceptatie (sectorVerzekeringskaart.ts:26-27). De klant ziet bij die sectoren aangepaste kenmerken (BAVApplicationModule.tsx:52) en een bevestigingsscherm met `handmatig`.
- Zeker mag geen acceptatiebeleid noemen (zeker.ts:113).
- Starters: KVK-inschrijving jonger dan 12 maanden, onder voorbehoud van controle (starterTarief.ts:19).
- Nergens gevonden: "altijd geaccepteerd". De conversiecheck is volgens het geheugen "altijd positief" (QualificationCheck).

**b. TEGENSTRIJDIG: mogelijk.** De beroepspagina's voor zorg en bouw beloven "binnen 24 uur", terwijl die aanvragen intern handmatig worden beoordeeld (zie 7).

**c. Wat de code doet:** voor zorg en bouw blokkeert de activatie zonder een bevestigde handmatige acceptatie.

## 10. Overige feiten

- **Jaren:** "13+ jaar" (index.html:39 meta-description, nl.json en andere: "Al 13+ jaar", "13+ jaar, 5.000+ zzp'ers") tegenover opgericht in 2014 (index.html:131, SiteSchemaMarkup.tsx:14, seoRoutes.ts:201/203/206/228, OverOns.tsx:36, Timeline.tsx:23). 2014 tot 2026 is 12 jaar, en het geheugen noemt het 12-jarig jubileum. **TEGENSTRIJDIG: ja.**
- **Aantal klanten:** "5.000+" en "meer dan 5.000" (via SITE_CONFIG.klantenAantalTekst). Overal gelijk. **Nee.**
- **Telefoon:** 020 - 457 3077 uit site.ts. Geen afwijkingen gevonden. **Nee.**
- **AFM:** 12050636 (site.ts:33). De foute variant 12050363 komt niet voor in de site-code. **Nee.** Het geheugenitem "Footer: AFM 12050363" is zelf fout.
- **Reactietijd:** "binnen 24 uur" en "binnen 1 werkdag" door elkaar (zie 7). **Ja, in de formulering.**
- **Openingstijden:** geen vaste vermelding gevonden die botst.
- **"Goedkoopste":** "Goedkoopste premie" als label op het jaarpakket, in de slug "goedkoopste-bav-avb" en in de concurrentievergelijking. Niet op /starters. Of dit is toegestaan: besluit Boy.
- **"Onafhankelijk":** "onafhankelijke adviseur" (index.html:39, seoRoutes.ts:41, Zeker:75). "Direct en onafhankelijk sinds 2014" (seoRoutes.ts:201). Niet tegenstrijdig, wel een claim om te toetsen.

## Extra opvallend (certificaat-PDF)

- generate-certificate:525-530 tekent bij "Polisvoorwaarden" een vaste tekst "Informatie en Communicatie Technologie". Of die per branche verandert, is in fase 2 te controleren.
- Dekkingsgebied, standaardtekst: "ongeacht waar in de EU" (generate-certificate:586). Elders op de site niet genoemd.

## Na fase 2

Boy heeft op 8 oktober 2026 de klantwaarheid vastgesteld. De fase-1-inventarisatie hierboven blijft als historisch verslag staan; de besluiten en controles hieronder vervangen de eerdere onzekerheden over de teksten. Layout en design zijn niet gewijzigd.

| Onderwerp | Nieuwe eenduidige klanttekst en vindplaatsen | Controle tegenstrijdige variant |
|---|---|---|
| 1. Opzegbaarheid | Geen jaarcontract, dagelijks opzegbaar, creditnota voor resterende al betaalde dagen. `bavPakketten`, FAQ, Starters-FAQ/FAQPage, pakketkaarten, wizard, Mijn ZP, offerte, llms en Zeker. | Oude jaarcontract-/opzegtermijnclaim niet meer in actuele klantteksten. |
| 2. Looptijd | Certificaatstandaard: "Doorlopend, zonder minimale looptijd, dagelijks opzegbaar." `generate-certificate`; NL/EN/DE/FR vertaald waar aanwezig. | **9 bestaande policies.contract_duration** bevatten nog de oude 12-maanden-/verlengingstekst. Bewust niet gewijzigd, geen bestaande certificaten opnieuw gemaakt of verstuurd. Nieuwe PDF-output gebruikt de nieuwe standaard. |
| 3. Creditnota | Maand- en jaarbetaling: naar rato van resterende betaalde dagen. `calculate-pauze-preview`, `PolicyLifecycleActions`, `faqItems`, `_shared/offerte`. | Het legacy-pad is bereikbaar vanuit de portal-acties. Maanduitsluiting verwijderd: gedeelde read-only `maandLifecycleCredit` leest factuurperioden en rekent met `berekenOpzegCredit`, dezelfde dagberekening als de planner. Factuur-ID deduplicatie voorkomt dubbel tellen. Geen live opzegging of Exact-credit uitgevoerd. |
| 4. Prijzen | "Bespaar € 60" in NL/EN/DE/FR. Starterbedragen en voorwaarden blijven ongewijzigd. "Goedkoopste" blijft buiten starters. | Geen €40-besparingsvariant gevonden. Activatiefactuurbedrag afzonderlijk hieronder. |
| 5. Eigen risico | Certificaat: "Eigen risico: geen". `PortalPolicy` toont altijd "Geen", ook bij leeg veld. | Oude PDF-uitleg dat ZP Zaken eigen-risicokosten draagt verwijderd uit generator; bestaande PDF-bestanden blijven intact. |
| 6. Verzekerde bedragen | BAV en AVB "per aanspraak"; bestaande jaarmaxima behouden. Cyber €50.000 per schade én maximaal €5.000.000 per jaar uit `bavPakketten` bij wizard, prijskaarten, Zeker en llms. | Geen klanttekst "per gebeurtenis" meer gevonden. Technische veldnamen `perGebeurtenis`, `bav_per_event` en `avb_per_event` zijn geen klanttekst en blijven intact. Artikel `cyberverzekering-zzp` bevat beide bedragen. |
| 7. Snelheid/ingangsdatum | "Binnen 24 uur geregeld, certificaat in je mailbox"; zorg/bouw "binnen 24 uur hoor je van ons". Wizard/server: "Online kan de ingangsdatum niet in het verleden liggen. Heb je een vraag, bel 020 - 457 3077." | "Direct gedekt/verzekerd", "binnen 1 werkdag/één werkdag" bij BAV-aanvragen en certificaten verwijderd. Reactieteksten van terugbelverzoeken, screening, klachten en factoring zijn geen verzekeringsdekking en vallen buiten deze vervanging. Geen automatische activatie toegevoegd. |
| 8. Inloop/uitloop | Kenmerk `runOffCoverage` verwijderd in alle vertalingen. Pauze-, zoek-, portal- en mailbeloften vervangen door contact/polisvoorwaarden bij claims voor eerder werk. | Geen toezegging behoud uitlooprisico meer. Algemene uitleg op vergelijkings-/bouwpagina blijft, zonder belofte voor ZP-polis. |
| 9. Doelgroep | Zorg/bouw normale aanvraagteksten zonder interne acceptatie-/offertetrajectmelding. Beveiligde teamcontroles blijven. | Geen "handmatige acceptatie" of "aparte beoordeling" in gescande klantteksten/artikelen. Interne teammeldingen en chatbot-instructie die deze woorden verbiedt zijn bewust behouden. |
| 10. Historie | Actief sinds 2013, 13+ jaar. `OverOns`, bestaande timeline-startjaar, `SiteSchemaMarkup`, `index.html`, `seoRoutes`, zoekdata. | Geen 2014-oprichtingsclaim gevonden. Geen nieuwe timelinegebeurtenissen verzonnen. |

### Activatiefactuurbedrag (apart)

Het maandpakket heeft nog een technische jaarpremie van €660 in de pakketspecificatie, maar de daadwerkelijke activatieconceptfactuur gebruikt `override.amount`: `calcMaandProrata` over de gekozen ingangsdatum tot de laatste dag van die maand. Dat is maximaal €55 bij een volledige maand, anders de eerste periode naar rato. Ook het opnieuw-proberen-pad gebruikt deze override. Daarom is uitsluitend de betalingsregel gewijzigd naar **"Betaling: maandelijks € 55 via SEPA-incasso, dagelijks opzegbaar"**. Bedragen en facturatieberekeningen zijn niet gewijzigd. Geen nieuwe Exact-factuur aangemaakt voor deze controle.

### Herhaalde controles

- Bronscan opnieuw uitgevoerd op pagina's, componenten, NL/EN/DE/FR, wizard/formulieren, mailtemplates, PDF-generator, Zeker, llms-generator, SEO/meta/JSON-LD. Zoekpatronen: `per gebeurtenis`, `direct (weer )?(verzekerd|gedekt)`, `binnen (1|één) werkdag`, `12 termijnen`, `2014`, `runOffCoverage`, `behoud van uitloop`, `uitlooprisico blijft`, `handmatige acceptatie`, `aparte beoordeling`, `bespaar.{0,6}40`; Engelse/Duitse varianten afzonderlijk gecontroleerd.
- Gepubliceerde `articles`: gerichte vervanging in vier artikelen met `updated_at`, niets verwijderd. Na controle **0 artikelen** met de bovenstaande tegenstrijdige Nederlandse varianten (content/title/excerpt/seo_description).
- Tabelkolommen geïnventariseerd op FAQ/page/content: geen afzonderlijke publieke FAQ-/paginadatabel gevonden. Artikelbackups en interne leadnotities blijven ongemoeid; integratie-/boekhoudconfiguratie bevat geen publieke FAQ-teksten. Geheimen niet gelezen of gelogd.
- Facturatie 13-19 oktober: **51 / €6.943,00; 1 geblokkeerde regel**. Directe RPC-uitvoering door de read-only rol is geweigerd. De controle is daarom uitgevoerd als read-only SQL met dezelfde kandidaatselectie, mappingvolgorde, periode-/starterberekening en blokkades als de gelezen functie, zonder rechten te verruimen. Zowel vóór als na de laatste wijzigingen identieke uitkomst.
- **79 tests geslaagd**: Zeker-bronsynchronisatie, offertes/sectoren, kredietberekeningen oud/nieuw, lifecyclemail, SEPA-bytegelijkheid, factuurtekst/periode, startertarief en drie nieuwe maandcredit-tests. Preview-buildlog meldt `build OK`.
- Browsercontrole op `/verzekeringen`, `/faq`, `/starters`, `/over-ons`: geen JavaScript-runtimefouten; pakket-/wizardtekst zichtbaar gecontroleerd. FAQ-antwoorden zijn ingeklapt en niet allemaal visueel geopend; bron en schema gecontroleerd.
- Gewijzigde functies gedeployed: `calculate-pauze-preview`, `polis-lifecycle`, `generate-certificate`, `lead-to-exact-activate`, `process-bav-wizard`, `send-notification`, `send-offerte`, `send-lead-notification`, `zeker-chat`, `submit-public-form`.

### Afbakening

Geen publicatie, klantmails, Exact-writes, verwijderingen of wijzigingen aan bestaande certificaten. De bestaande voorwaarden/IPID/PDF-bestanden van de verzekeraar zijn niet herschreven; de vaste ICT-polisvoorwaardenregel in de certificaatgenerator is buiten deze tekstbesluiten gebleven. De daadwerkelijke afhandelingstijd en geldigheid van toekomstige claims zijn niet via een live klantactie getest. De code- en tekstcontrole is geen bevestiging van verzekeraarsdocumenten buiten deze bronnen.
