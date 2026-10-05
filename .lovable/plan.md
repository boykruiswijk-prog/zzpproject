# SEO-update kennisbank en redirects

## Uitvoering

1. **Veilige artikelback-up**
   - Maak `public.articles_backup_20261005` met exact dezelfde kolommen als `public.articles`.
   - Kopieer alleen de vijf opgegeven artikelen.
   - Zet RLS aan, trek publieke rechten in en geef uitsluitend `service_role` toegang.
   - Verwijder geen rijen of bestaande data.

2. **Kostenartikel samenvoegen**
   - Werk het canonieke artikel bij met exact de aangeleverde titel, SEO-velden, samenvatting en markdown.
   - Behoud afbeelding, categorie en auteur; wijzig `updated_at` naar het uitvoermoment.
   - Zet `zzp-verzekering-kosten-2026` op niet-gepubliceerd zonder het artikel te verwijderen.
   - Vervang interne artikel- en broncodeverwijzingen naar de oude slug door de canonieke slug.
   - Voeg natuurlijke interne links toe op `/verzekeringen` en `/bav-zzp-vergelijken`.

3. **FAQ-schema voor kennisbankartikelen**
   - Breid het bestaande artikelsjabloon uit zodat vijf vragen onder `## Veelgestelde vragen` met `###`-koppen automatisch dezelfde zichtbare antwoorden én FAQPage JSON-LD opleveren.
   - Laat bestaande handmatig ingestelde artikel-FAQ's ongewijzigd werken.

4. **Redirects en Cloudflare-lijst**
   - Voeg beide kostenartikelredirects toe naar het canonieke artikel.
   - Wijzig alleen de drie genoemde AOV-redirects naar `/aov`.
   - Houd de gedeelde redirectkopie gelijk en regenereer `docs/cloudflare-bulk-redirects.csv` via de bestaande buildgenerator.

5. **Leesbare interpunctie in drie artikelen**
   - Vervang per zin de em dash door passende interpunctie.
   - Zet en-dashes in eurobereiken om naar `€ 20 tot € 60`-stijl.
   - Rapporteer per artikel letterlijk de oude en nieuwe gewijzigde zinnen.

6. **Controle**
   - Controleer dat gepubliceerde artikelen geen em dash meer bevatten.
   - Controleer de back-up, publicatiestatus, redirects, interne links en FAQ-schema.
   - Draai gerichte tests en laat de automatische buildcontrole slagen.
   - Publiceer niet.

## Technische details

- De tabelwijziging en back-upkopie komen samen in één additieve migratie met expliciete `GRANT`-rechten.
- Artikelinhoud wordt pas na de back-up bijgewerkt.
- De canonieke artikelafbeelding, categorie, `author_id` en `author_name` worden niet overschreven.
- De bestaande fiscale tokens en prerenderroute blijven intact.
