# Rapport: inloop, uitloop en aanspraken na beëindiging (alleen zoeken, niets gewijzigd)

Gezocht naar: inloop, uitloop, inlooprisico, uitlooprisico, run-off/runoff, retroactie, terugwerkende kracht, na beëindiging.
Doorzocht: src, public (incl. llms.txt), supabase/functions (incl. Zeker-kennis zekerKennis.generated.ts), scripts, tabel articles (titel, intro, tekst), en de tekst van alle 19 PDF's in public/documenten.

## 1. Code en sitekennis (5 vondsten)

| Bestand:regel | Volledige zin | Waar ziet de klant dit |
|---|---|---|
| src/pages/BavZzpVergelijken.tsx:109 | "Inloop en uitloop: Inloop (ook wel voorrisico) dekt fouten die je maakte voordat de polis begon, maar die pas later bekend worden. Uitloop dekt claims die binnenkomen nadat je de polis hebt gestopt. Dat is belangrijk als je stopt als zzp'er of overstapt." | https://zpzaken.nl/bav-zzp-vergelijken (uitlegblok "Waar let je op") |
| src/data/bavVergelijking.ts:143 | FAQ "Wat is uitloop en heb ik dat nodig?" – "Uitloop dekt claims die binnenkomen nadat je je polis hebt gestopt, voor fouten uit de tijd dat je verzekerd was. Dat is handig als je stopt als zzp'er. Vraag bij elke aanbieder na of en hoe uitloop geregeld is." | https://zpzaken.nl/bav-zzp-vergelijken (FAQ, ook in FAQPage-data voor zoekmachines) |
| src/data/searchIndex.ts:189 | Zoekwoord "uitlooprisico" bij het resultaat "FAQ – Hoe pauzeer ik mijn verzekering?" (zichtbare tekst: "Pauzeer je verzekering via Mijn ZP. Tijdens de pauze ben je niet verzekerd voor nieuwe werkzaamheden.") | Niet als tekst zichtbaar; alleen een zoekwoord in de zoekfunctie van de site, dat naar https://zpzaken.nl/faq leidt |
| src/data/fiscaleCijfers.ts:257 | "Geldt voor IB-ondernemers, zzp'ers, vennoten in een VOF en maten in een maatschap, voor zakelijke ritten met een privevervoermiddel. Met terugwerkende kracht vanaf 1 januari 2026." | Fiscaal (kilometeraftrek), niet over verzekering; toelichting bij dit fiscale cijfer in de kennisbank |
| src/data/fiscaleCijfers.ts:267 | "Met terugwerkende kracht vanaf 1 januari 2026." | Idem, fiscaal |

Geen vondsten in: public/llms.txt, de Zeker-chatkennis, mailteksten, het certificaat, Mijn ZP, de aanvraag, scripts.

## 2. Database

| Tabel | Artikel | Zin | URL |
|---|---|---|---|
| articles (gepubliceerd) | hoe-zit-het-met-reiskosten-als-zzp-er | "De kilometeraftrek voor zzp'ers is verhoogd van 0,23 naar {kilometeraftrek} per kilometer, met terugwerkende kracht vanaf 1 januari 2026" | https://zpzaken.nl/kennisbank/hoe-zit-het-met-reiskosten-als-zzp-er (fiscaal, niet over verzekering) |

Geen andere vondsten in articles. In de eerdere controle stonden ook geen treffers in de andere teksttabellen (social_media_features, collective_suggestions).

## 3. PDF's in public/documenten (te vinden via https://zpzaken.nl/documenten)

Geen vondsten in: alle brochures, alle verzekeringskaarten (ook HAVB-08B bedrijfsaansprakelijkheid), dienstverleningsdocument, gedragscode, slotverklaring-2026. Het woord "uitloop" of "run-off" komt in geen enkele PDF voor.

**Polisvoorwaarden-beroepsaansprakelijkheid-TPH-2020.pdf** (ICT)
- Art. 1.16 Inloopdatum: gelijk aan de aanvangsdatum van de verzekeringsperiode, tenzij de polis anders vermeldt; bij een deelneming de datum waarop je zeggenschap kreeg.
- Art. 2.1 Aanspraken van derden: gedekt voor werkzaamheden vanaf de inloopdatum, mits de aanspraak binnen de looptijd voor het eerst is ingesteld en binnen de looptijd is gemeld (claims-made). Art. 2.2.4 Reclame: ook vanaf de inloopdatum.
- Art. 4.2 Meldingen: melden vóór het einde van de looptijd of tot 60 dagen na het einde. Een omstandigheid die tijdens de looptijd is gemeld, geldt als aanspraak op het moment van die melding.
- Geen uitloopdekking (dekking voor claims die na het einde binnenkomen) behalve deze meldtermijn van 60 dagen.

**Polisvoorwaarden-beroepsaansprakelijkheid-MCPH-2013B.pdf** (management consultancy), **Coaches-Polisvoorwaarden-…-MCPH-2013B.pdf** (zelfde tekst) en **Overige-zakelijke-dienstverlening-Polisvoorwaarden-…-MPH-2013B.pdf**
- Deel 2 Dekking, "Aanspraken tegen u": gedekt voor werkzaamheden vanaf de inloopdatum, mits binnen de looptijd voor het eerst ingesteld en gemeld. "Maken van reclame": vanaf de inloopdatum.
- Deel 4 Algemene voorwaarden, "Meldingen aan ons": aanspraken en omstandigheden melden vóór het einde van de looptijd of uiterlijk 30 dagen na het einde. Een omstandigheid die tijdens de looptijd is gemeld, geldt als ingesteld op het moment van melding.
- Deel 5 Definities, "Inloopdatum": de datum in de polis; tenzij anders vermeld gelijk aan de ingangsdatum (bij een deelneming de datum van zeggenschap).

**Polisvoorwaarden-beroepsaansprakelijkheid-MAPM-08B-1.pdf** (marketing, reclame en communicatie)
- Art. 3, MAPM I: gedekt voor aanspraken die binnen de looptijd voor het eerst zijn ingesteld, voor werkzaamheden vanaf de inloopdatum.
- MAPM II C "Meldingstermijn na beëindiging": beëindigt Hiscox de polis, dan kunnen aanspraken en omstandigheden die in de 30 dagen vóór de beëindiging bekend werden, nog tot 30 dagen na de beëindiging worden gemeld. Dit geldt alleen bij beëindiging door Hiscox.
- Definities, "Inloopdatum": de in de polis aangetekende datum; tenzij anders overeengekomen gelijk aan de ingangsdatum.
- Bij beëindiging van de verzekering: terugbetaling naar billijkheid van de premie over de periode waarin de verzekering niet meer loopt (premie, geen dekking).

**Beroepsaansprakelijkheid_voorwaarden_kantoorrisico.pdf** (aanvullend, kantoorrisico)
- Art. 8.2 Einde van de verzekering: bij beëindiging naar billijkheid terugbetaling van de premie over het tijdvak waarin de verzekering niet meer loopt. Verder niets over inloop of uitloop.

## 4. Opvallende punten (alleen gemeld, niet aangepast)

- /bav-zzp-vergelijken legt inloop en uitloop uit als algemeen begrip. In de gepubliceerde voorwaarden staat geen uitloopdekking, alleen een meldtermijn van 30 of 60 dagen na het einde. Inloop is standaard gelijk aan de ingangsdatum, dus er is geen dekking voor eerder werk, tenzij de polis een eerdere inloopdatum vermeldt.
- Bij Documenten wijst de link "Polisvoorwaarden bedrijfsaansprakelijkheid" naar het verzekeringskaart-bestand HAVB-08B. Een aparte voorwaarden-PDF voor bedrijfsaansprakelijkheid staat niet in public/documenten.
- "uitlooprisico" staat nog als verborgen zoekwoord in de zoekfunctie van de site, bij de pauze-FAQ.

Er is niets gewijzigd. Wil je dat één van deze punten wordt aangepast? Geef het aan; dan maak ik daar een apart plan voor.
