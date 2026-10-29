# Kwaliteitscontrole 29 oktober 2026

Niet gepubliceerd. Geen mails verstuurd of wijzigingsmelding toegevoegd. Geen Edge Functions gedeployed of functionele handlercode gewijzigd. Prijzen, offers, bedragen, facturatie, SEPA, Exact en formulierlogica ongewijzigd. Geen gegevens verwijderd.

## Per punt

1. Homepagezin vervangen in `src/i18n/locales/nl.json`; overeenkomstige zin vertaald in `en.json`, `de.json` en `fr.json`. De bestaande tweede zin over 15 minuten behouden. Commit `a68ac8bc`.
2. Pakketkeuzetext gewijzigd naar `Kies je pakket` via dezelfde gedeelde vertaalbron; EN/DE/FR bijgewerkt. Dit geldt op homepage en /verzekeringen zonder formulierlogica aan te passen. Commit `a68ac8bc`.
3. /verzekeringen-subtitel gewijzigd in dezelfde vier vertaalbestanden. De genoemde oude zin stond niet in seoRoutes/meta; die ongewijzigd. Commit `a68ac8bc`.
4. Beide cyberpakketbeschrijvingen in `src/lib/schema.ts` tonen `€ 82,50 per maand of € 850 per jaar, inclusief kosten en assurantiebelasting.`. De daadwerkelijke Offer-prijzen en prijsbronnen niet gewijzigd. Commit `a68ac8bc`.
5. De genoemde zin in `src/pages/Starters.tsx` vermeldt nu aansprakelijkheid en `volgens de polisvoorwaarden`. Commit `a68ac8bc`.
6. /bav-zzp-description in `src/config/seoRoutes.ts`: `Beroepsaansprakelijkheidsverzekering: aansprakelijkheidsverzekering zzp voor € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting.`. De pagina gebruikt deze bron voor meta description, og:description, twitter:description en JSON-LD Service.description; alle vier in de preview exact gelijk bevestigd. De llms-generator leest dezelfde description, dus generatorcode hoefde niet gewijzigd. `public/llms.txt` bijgewerkt. De oude identieke zin stond niet in llms-full. Commits `a68ac8bc`, `794aab67`.
7. De /documenten-description en intro in `src/config/seoRoutes.ts` noemen overige documenten; de intro verwijst expliciet naar `Polisvoorwaarden: https://zpzaken.nl/voorwaarden`. Beide llms-generators nemen dit automatisch over. `public/llms.txt`, `public/llms-full.txt` en de afgeleide `supabase/functions/_shared/zekerKennis.generated.ts` bijgewerkt. Commits `a68ac8bc`, `794aab67`.
8. Vacatureintro, beide vacaturetitels, buitendienstmedewerker en collega in `src/pages/OverOns.tsx`; twee taalfouten in `src/i18n/locales/nl.json`; spaties bij de dubbele punt in `src/components/over-ons/SocialFeaturesSection.tsx`. Ellen houdt `Senior Adviseur`. EN/DE/FR hadden de twee Nederlandse taalfouten niet; vacatures en sociale tekst delen de Nederlandse paginabron. Commit `a68ac8bc`.
9. Eén gerichte UPDATE met replace() uitgevoerd voor `articles.slug = bedrijfsaansprakelijkheidsverzekering-zzp`, id `00f995fe-3232-47d2-85f3-63f380919409`. Alleen `Twijfel je welke dekking bij jouw werk past?` vervangen door `Vragen over de dekking?`; `updated_at = 2026-10-29 06:38:34.11276+00`. Hele content teruggelezen en rest ongewijzigd. Dit is een directe databasecorrectie, geen codecommit; het gepubliceerde artikel kan deze zin meteen tonen. Bestaande artikeltriggers vooraf gelezen: geen mailtrigger; bestaande activiteit/IndexNow blijft intact.

## Controle

- `src/test/kwaliteit2910.test.ts`: 28 gerichte controles op oude zinnen, vertalingen, BAV-description, cyberbeschrijvingen/offerprijzen en voorwaardenverwijzing. Commits `45c18159`, `794aab67`.
- Nieuwe test plus bestaande kwaliteit-tests 23 t/m 28 oktober, Zeker- en SEO-titeltests: **135 geslaagd, 0 mislukt**, 9 testbestanden.
- Automatische bouwcontrole: **build OK**.
- Preview: homepage, /verzekeringen, /starters, /over-ons en het artikel gecontroleerd; BAV-meta/OG/Twitter/Service exact gelijk; geen runtimefouten, geen inzendingen.
- Zeker is opnieuw gegenereerd uit de bronnen, niet gedeployed. Daarbij zijn ook de al eerder goedgekeurde BAV-H1/intro uit de voorgaande opdracht in het afgeleide kennisbestand gesynchroniseerd; geen nieuwe paginacopy bedacht.

## Codecommits

- `a68ac8bc`: pagina-/vertaal-/schema-/SEO-correcties en roadmaptaak.
- `45c18159`: gerichte kwaliteitstest.
- `794aab67`: afgeleide llms/Zeker-teksten en laatste testcorrectie.

Dit rapport en de afgeronde roadmapstatus worden daarna automatisch afzonderlijk vastgelegd. Databasewijziging hoort niet bij een Git-commit.