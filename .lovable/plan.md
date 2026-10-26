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

