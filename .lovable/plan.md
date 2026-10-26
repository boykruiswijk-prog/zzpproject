# Cyber toevoegen via Aanvragen, E-aanvulling 8

## Resultaat
- Verzoeken uit Mijn ZP en team komen in dezelfde aanvraaglijst, met label **Cyber toevoegen**, klant, BAV-nummer, ingang, betaalwijze en notitie. Pieter blijft open voor Ellen.
- Cyberwerk telt mee bij de open werkvoorraad en Vandaag te doen, maar nooit bij het doel van 200, conversie of nieuwe klanten. De bestaande sluitcontrole bewaakt dit onderscheid.
- De aanvraag heeft afzonderlijke stappen: beoordelen met toelichting, activeren, cybercertificaat aanmaken, PDF controleren, versturen.
- Akkoord en activering versturen niets automatisch. Pas na Ellens controle en verzendklik gaat eerst het certificaat en daarna de bestaande bevestigingsmail uit, met behoud van claims en veilige herpogingen.

## Behouden regels
- Vaste cyberklanttekst en het goedgekeurde cybercertificaat blijven ongewijzigd.
- Terugwerkende ingang uitsluitend Ellen, met verplichte notitie.
- Bestaande cyberlooptijd, betaalwijze en planner blijven leidend. Geen nieuwe Exact-verwerking, verwijderingen of echte klantmails tijdens tests.

## Technische uitvoering
- Integreer de cyberwerkvoorraad in de bestaande Aanvragen-weergave, detaildialoog en gedeelde SQL-actietellingen zonder nieuwe leads aan te maken.
- Splits de bestaande coordinator op expliciete acties. Bewaar documentcontrole vóór de server verzendclaims mag nemen; hergenereren maakt een eerdere controle ongeldig.
- Gebruik bestaande cybergenerator, PDF-opslag/preview en mailhelpers. Houd menselijke rol/MFA-controles en afzonderlijke gemarkeerde droge testtoegang intact.
- Documenteer de workflowregel in AGENTS en behoud historische akkoordbewijzen.

## Controle en oplevering
- Tests voor beide betaalwijzen, afzonderlijke stappen, nul verzending bij akkoord/activatie, verplichte PDF-controle, certificaat vóór bevestiging, idempotentie en veilige retry.
- Tests voor uitsluiting uit doel/instroom, opname in werkvoorraad en behoud van E6, akkoordtekst en certificaatregels.
- Gemarkeerde droge end-to-endcontrole zonder echte mails of Exact-mutaties; Pieter uitsluitend lezen en zichtbaar maken.
- Na groene controles functies deployen, website publiceren, live controleren en precies één gewone melding aan Ellen.

<!-- Vorig plan vervangen door deze nieuwe opdracht. -->
## Historisch plan (niet uitvoeren)
- Alle 120 bestandsverwijzingen in de 66 artikelen wijzen naar eigen opslag; alle bijbehorende bestanden bestaan. Geen actieve artikelafbeelding of download verwijst naar de oude WordPress-host. De 48 oude bronadressen zijn importhistorie, geen geladen bestanden.
- Twee oude beheerfuncties kunnen nog WordPress benaderen: `wp-import` en `image-migrate`, via `zpzaken.nl`, `www.zpzaken.nl` en `img.poweredcache.net`. Ook een proefactie kan daar een verzoek doen.
- Publieke formulieren hebben bestaande spambescherming, maar de BAV-functie slaat die beperking over zodra een opgegeven e-mailadres recent voorkomt. Invoer wordt niet overal op het juiste type gecontroleerd of van HTML ontdaan.
- Otentica weigert zonder ingestelde geheime sleutel. De live controle gaf `503 webhook_not_configured`; verwerking van callbacks is nog niet geïmplementeerd. Na verificatie wordt momenteel de volledige inhoud gelogd.
- Live zijn HSTS, `nosniff` en Referrer-Policy aanwezig. CSP staat in de pagina; `frame-ancestors` ontbreekt in de live HTTP-headers, ondanks de bestaande instelling in het project.
- De lokale MFA-tests slagen. Dat bewijst niet dat alle eerder gewijzigde functies al live dezelfde controle gebruiken.

## Gerichte wijzigingen
1. Blokkeer de twee oude importacties vóór enig WordPress-verzoek, zonder knoppen, pagina’s, historische artikelen of opgeslagen bestanden te verwijderen.
2. Voeg gedeelde invoercontrole toe voor aanvraag, terugbel/contact en Zeker-chat: objectvorm, veldtypen, lengte, e-mail en veilige geneste gegevens. Verwijder HTML uit nieuwe vrije tekst vóór opslag en verwerking; laat SEPA-tekst, akkoordbewijs en bestaande gegevens ongemoeid.
3. Herstel het overslaan van de bestaande BAV-spambescherming op alleen een e-mailadres. Behoud bestaande limieten; voeg geen nieuwe zelfgebouwde limiter toe. Meld resterende beperkingen, zoals niet-atomische tellingen en de afzonderlijke validatielogroute, expliciet.
4. Begrens Otentica-verzoeken, accepteer alleen de juiste methode en geldige objectinhoud, en verwijder volledige payloadlogging. Behoud handtekening-/secretcontrole en voeg geen screeningverwerking toe.
5. Maak machinecontrole van de mailwachtrij onafhankelijk van een onbewezen JWT-rolclaim: vergelijk met het echt ingestelde machine-token vóór verwerking. Mailinhoud en verzendlogica blijven gelijk.
6. Controleer CSP-bronnen op daadwerkelijk gebruikte diensten. Verwijder alleen aantoonbaar onnodige ruime toestemmingen als browsercontrole aantoont dat dit veilig kan. URL’s, titels, SEO-meta’s, trackingcode en layout blijven gelijk.

## Controle en oplevering
- Uitgevoerd: 169/169 gerichte tests, zeven echte Deno-opstartproeven met nul externe effecten, zeven deployments en live weigeringen zonder BOOT_ERROR. Mailwachtrij met geldig niet-bevoorrecht token: 403. Contact en terugbel bevestigen correct met onderschepte inzending; aanvraagprefill blijft werken. Geen echte inzending of mail. Browserchatverzending nog niet bevestigd.
- Nieuwe tests voor ongeldige typen, HTML, te grote/geneste invoer, geweigerde webhook, geblokkeerde WordPress-import, machine-authenticatie en ontbrekende MFA; concrete asserts op nul writes/verzending vóór weigering.
- Bestaande MFA-, formulier-, SEPA-, tracking- en klantmailtests, inclusief droge klantmailproeven zonder verzending.
- Opstartproeven van gewijzigde functies met ongeldige invoer of ontbrekende toegang, zonder klantgegevens aan te maken of mails te versturen.
- Browsercontrole van aanvraag/terugbel/chat met onderschepte inzendingen en controle op ongewenste oude-serververzoeken. Automatische bouwcontrole.
- Rapport per gevraagd punt, gevonden hostnamen, gewijzigde bestanden, testresultaten en korte tekst voor Ellen.

## Grenzen en open punten
- Geen websitepublicatie, Cloudflare-wijzigingen, klantdatawijzigingen, Exact-aanroepen of echte mails. Geen routings- of inhoudswijzigingen voor Google.
- Een oude PHP-server kan niet vanuit deze app worden gepatcht of uitgeschakeld. De voormalige hostingbeheerder moet bevestigen of hij nog bestaat en hem isoleren of patchen volgens het officiële PHP-bericht.
- De ontbrekende live `frame-ancestors`-header blijft een hostingpunt zolang de hosting de bestaande headerinstelling niet toepast. Geen bescherming claimen op basis van alleen het bestand.
- Volledige live MFA-controle vereist een geldige MFA-sessie; deze ontbreekt momenteel. Alleen gecontroleerde weigeringen en tests met nagebootste sessies zijn beschikbaar.
- De afhankelijkhedenscan meldt daarnaast kwetsbare pakketten. Geen brede pakketupdates binnen dit gerichte herstel zonder apart gecontroleerde regressietests; neem dit op als resterend risico.
- Validatietelemetrie heeft nog geen limiet. Bestaande formulierlimieten tellen niet atomisch en laten bij bepaalde fouten door; doorgestuurde IP-headervertrouwen is niet bevestigd. Nieuwe zelfgebouwde limiter alleen na akkoord over dit platformnadeel.

## Technische aanpak
- Eén kleine gedeelde validatiemodule met Zod en veilige plaintext-normalisatie, gebruikt bij de betreffende publieke ingangspunten. Bestaande bedrijfregels blijven na validatie ongewijzigd.
- Oude importfuncties behouden hun toegangscontrole en antwoorden daarna met een vaste weigering, zonder remote fetch of writes.
- Geen databasemigraties of verandering van bestaande rechten nodig voor het gerichte herstel.