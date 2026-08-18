# Bedrijfsgegevens: bevindingen en voorstel tot één bron van waarheid

## 1. Waar komt het blok op de contactpagina vandaan?

Het blok "ZP Zaken kantoor / Tupolevlaan 41 / AFM / KIFID / KvK / BTW: NL854662431B01" staat **niet in deze codebase**. Het komt van de **WordPress-site die momenteel op zpzaken.nl draait**.

Bewijs:
- `curl https://zpzaken.nl/contact` bevat wel "ZP Zaken kantoor" en "NL854662431B01"; de response headers tonen `server: LiteSpeed`, `wp-content`, generator **Elementor**, en de titel "Neem gerust contact op! | Zorgeloos ZZP'en | ZP Zaken".
- De gepubliceerde versie van dit project (`zzpproject.lovable.app/contact`) bevat die strings **niet**.
- In de repo bestaat geen enkele treffer op "ZP Zaken kantoor", "NL854662431B01" of "KIFID:" (case-sensitive gezocht over de hele codebase).
- De contactpagina in dit project is `src/pages/Contact.tsx` (route `/contact`, geregistreerd in `src/App.tsx:178`). Die pagina heeft alleen een "Direct contact"-kaart met telefoon, e-mail, WhatsApp en `Tupolevlaan 41, 1119 NW Schiphol-Rijk` (`src/pages/Contact.tsx:157`) — géén AFM/KvK/BTW-blok.

Waarom mijn eerdere zoekopdracht het niet vond: de zoekopdracht was correct, maar de aanname was fout. Ik keek naar de React-contactpagina van dit project; het blok dat je live ziet wordt gerenderd door de oude WordPress-site op het domein. Er is dus geen CMS/database/vertaalbestand in dit project dat dit blok opbouwt. Consequentie: de bedrijfsgegevens worden nu op twee losstaande plekken onderhouden (WordPress + deze codebase), plus in statische PDF's.

## 2. Adressen (alle vindplaatsen)

Tupolevlaan 41, 1119 NW Schiphol-Rijk — consistent:
- `src/config/site.ts:12-15`, `index.html:63-66`, `src/data/googleReviews.ts:34-37`
- `src/components/layout/Footer.tsx:69`, `src/pages/Contact.tsx:157`
- `src/pages/Klachtenprocedure.tsx:89, 172-173`, `src/pages/AlgemeneVoorwaarden.tsx:61, 215-216`, `src/pages/Cookies.tsx:263`
- `src/i18n/locales/nl|en|de|fr.json` (regel ~456-461): "Tupolevlaan 41, Schiphol-Rijk"
- `supabase/functions/generate-invoice/index.ts:246-249`
- `public/documenten/dienstverleningsdocument.pdf`, `gedragscode.pdf`, `slotverklaring-2026.pdf` (voettekst: Tupolevlaan 41, 1119 NW Schiphol-Rijk)
- `public/documents/ZP_Slotverklaring.pdf` (Tupolevlaan 41, zonder postcodeblok)
- `supabase/functions/analyze-dba/index.ts:1466` — Onefellow B.V., Tupolevlaan 41 (correct, gedeeld adres)

Afwijkingen:
- **`src/components/documenten/DocumentPage.tsx:98` — "Tupolevlaan 41-61, 1119 NW Schiphol-Rijk"** (huisnummerreeks 41-61 in plaats van 41).
- `src/components/historie/Timeline.tsx:57-61` — "Kantoor in Hoofddorp" (historisch, tijdlijnitem; geen actueel vestigingsadres).
- Géén enkele vindplaats met "Hoofdweg Oostzijde".

## 3. Btw-nummers in omloop

| Nummer | Vindplaats |
| --- | --- |
| NL854662431B01 | live WordPress-contactpagina zpzaken.nl (niet in deze repo) |
| **NL854862431B01** | `supabase/functions/generate-invoice/index.ts:251` (factuur-PDF) — wijkt af op één cijfer (854**8** vs 854**6**) |
| NL813551456B03 | `public/documents/ZP_Slotverklaring.pdf` (verouderd document) |
| NL862134754B01 | `supabase/functions/analyze-dba/index.ts:1467` — dit is Onefellow B.V., niet ZP Zaken |

Er staat dus nergens in de codebase een btw-nummer van ZP Zaken dat gelijk is aan het nummer op de live contactpagina.

## 4. Volledig overzicht bedrijfsgegevens

| Gegeven | Waarden in omloop | Plekken |
| --- | --- | --- |
| Naam | ZP Zaken B.V. | `src/config/site.ts:4`, footer, juridische pagina's, PDF's — consistent |
| Adres | Tupolevlaan 41, 1119 NW Schiphol-Rijk | zie punt 2 |
| | Tupolevlaan 41-**61** | `DocumentPage.tsx:98` (afwijkend) |
| | Hoofddorp | `Timeline.tsx:57-61` (historisch) |
| Telefoon | 020 - 457 3077 / +31204573077 / 020-4573077 | `site.ts:8-9`, Footer, Contact, PDF's, `polis-lifecycle:104`, `generate-invoice:252` — zelfde nummer, wisselende notatie |
| | **023-2010502** | `public/documents/ZP_Slotverklaring.pdf` (verouderd) |
| WhatsApp | 06 - 5206 4589 / wa.me/31652064589 | Footer, Contact |
| E-mail | info@zpzaken.nl | `site.ts:7`, Footer, Contact, Klachtenprocedure, alle mailfuncties, PDF's |
| | **administratie@zpzaken.nl** | `generate-invoice/index.ts:253` (factuurvoettekst) |
| AFM | 12050636 | `site.ts:20`, Footer/JSON-LD via `SiteSchemaMarkup.tsx:41`, `FAQ.tsx:34`, `Klachtenprocedure.tsx:43`, `index.html:124`, `DocumentPage.tsx:102`, `generate-certificate:487, 517`, `polis-lifecycle:104`, 3 PDF's in `public/documenten` |
| | **12050363** | `public/documents/ZP_Slotverklaring.pdf:30` (verouderd, ongewijzigd gelaten) |
| KvK | 62117092 | `site.ts:21`, JSON-LD, `DocumentPage.tsx:102`, `generate-invoice:250`, 3 PDF's |
| | 81550022 | `analyze-dba:1467` — Onefellow B.V. (correct in die context) |
| Kifid | 300.019283 | `site.ts:22`, JSON-LD, Footer, `Klachtenprocedure.tsx`, 3 PDF's. Ontbreekt in `ZP_Slotverklaring.pdf` |
| BTW | zie punt 3 — 3 verschillende nummers voor ZP Zaken | niet in `site.ts` |
| IBAN | NL25 ABNA 0477 3302 23 | `generate-invoice/index.ts:249` en (als NL25 ABNA0 477330223) `ZP_Slotverklaring.pdf` |
| | NL08 RABO 0343814471 | `analyze-dba:1467` — Onefellow B.V. |

## 5. Voorstel (nog niets uitgevoerd)

Zodra je de juiste waarden bevestigt:

1. **`src/config/site.ts` uitbreiden tot enige bron van waarheid**: `vat` (btw) en `iban` toevoegen naast AFM/KvK/Kifid, plus `emailAdministratie`.
2. **Hardcoded waarden vervangen door `SITE_CONFIG`** in `DocumentPage.tsx` (inclusief correctie 41-61 → 41), `Footer.tsx`, `Contact.tsx`, `Klachtenprocedure.tsx`, `AlgemeneVoorwaarden.tsx`, `Cookies.tsx`.
3. **Edge Functions**: één `_shared/company.ts` met dezelfde gegevens, gebruikt door `generate-invoice`, `generate-certificate` en `polis-lifecycle`; btw-nummer in `generate-invoice:251` corrigeren.
4. **Contactpagina in dit project** het AFM/KIFID/KvK/BTW-blok geven zoals live, zodat de React-site de WordPress-pagina volwaardig vervangt.
5. **`public/documents/ZP_Slotverklaring.pdf`**: verouderd (AFM 12050363, oud telefoonnummer, oud btw-nummer, geen Kifid/KvK). Voorstel: verwijderen of vervangen door `public/documenten/slotverklaring-2026.pdf`; eerst nagaan of er nog naar gelinkt wordt.

### Nog te bevestigen door jou

- Welk btw-nummer is juist: NL854662431B01 (live) of NL854862431B01 (factuur-PDF)?
- Is `administratie@zpzaken.nl` bedoeld op facturen, of moet dat ook info@ worden?
- Mag `ZP_Slotverklaring.pdf` weg?
