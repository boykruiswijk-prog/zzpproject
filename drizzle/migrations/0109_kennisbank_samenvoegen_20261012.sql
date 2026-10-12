CREATE TABLE public.articles_backup_20261012 (LIKE public.articles INCLUDING ALL);
GRANT ALL ON public.articles_backup_20261012 TO service_role;
REVOKE ALL ON public.articles_backup_20261012 FROM anon, authenticated;
ALTER TABLE public.articles_backup_20261012 ENABLE ROW LEVEL SECURITY;
INSERT INTO public.articles_backup_20261012 SELECT * FROM public.articles WHERE slug IN (
 'zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb','bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt',
 'vbar-zzp-verzekering-gevolgen','vbar-wet-verduidelijking-arbeidsrelaties','boekhouding-zzp','zzp-administratie-en-boekhouding',
 'starten-als-zzper-welke-verzekeringen','welke-verzekeringen-zzp','zelfstandigenwet-voor-zzp-ers','zelfstandigenwet-verzekering-zzp',
 'bedrijfsaansprakelijkheidsverzekering-zzp','verschil-bav-avb-zzp','wat-kosten-verzekeringen-voor-zzp-ers','starten-met-ondernemen-als-zzper');

CREATE TABLE public.article_samenvoegingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bron_slug text NOT NULL UNIQUE,
  doel_slug text NOT NULL,
  notitie text NOT NULL,
  samengevoegd_op timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.article_samenvoegingen TO service_role;
REVOKE ALL ON public.article_samenvoegingen FROM anon, authenticated;
ALTER TABLE public.article_samenvoegingen ENABLE ROW LEVEL SECURITY;

INSERT INTO public.article_samenvoegingen (bron_slug, doel_slug, notitie) VALUES
('zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb','bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt','Dubbele content (Search Console), 12 okt 2026. Overgenomen: BAV/AVB-verschiltabel, AVB-voorbeelden, stappen, FAQ en AOV-vermelding. Backup in articles_backup_20261012.'),
('vbar-zzp-verzekering-gevolgen','vbar-wet-verduidelijking-arbeidsrelaties','Dubbele content (Search Console), 12 okt 2026. Overgenomen: verzekeringsgevolgen BAV/AVB/AOV en stappen; doel bijgewerkt met stand oktober 2026. Backup in articles_backup_20261012.'),
('boekhouding-zzp','zzp-administratie-en-boekhouding','Dubbele content (Search Console), 12 okt 2026. Overgenomen: neutrale alinea over boekhoudsoftware, zonder partijnaam. Backup in articles_backup_20261012.'),
('starten-als-zzper-welke-verzekeringen','welke-verzekeringen-zzp','Dubbele content (Search Console), 12 okt 2026. Overgenomen: sectie Starten als zzp''er met startertarief en link naar /starters. Backup in articles_backup_20261012.');

-- 1. BAV
UPDATE public.articles SET
 content = replace(replace(replace(replace(replace(replace(content,
  'een deadline wordt gemist door een misverstand', 'een opdracht wordt door een misverstand anders uitgevoerd dan afgesproken'),
  E'## Hoe snel kun je een BAV afsluiten?', $t$## BAV en AVB: wat is het verschil?

De BAV en de AVB vullen elkaar aan:

| Verzekering | Dekt |
|---|---|
| **BAV** | Financiële schade door een fout in je werk (vermogensschade) |
| **AVB** | Schade aan personen of spullen van anderen (letsel- en zaakschade) |

Voorbeelden voor de AVB: een bezoeker struikelt over je apparatuur, of je veroorzaakt per ongeluk waterschade bij je opdrachtgever. Veel opdrachtgevers vragen beide verzekeringen. Meer voorbeelden lees je in [Verschil tussen BAV en AVB](/kennisbank/verschil-bav-avb-zzp).

## Hoe snel kun je een BAV afsluiten?$t$),
  'via Hiscox, vanaf € 55 per maand, zonder eigen risico en dagelijks opzegbaar.', 'via Hiscox, voor € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting. De dekking geldt per aanspraak, zonder eigen risico, en de polis is dagelijks opzegbaar.'),
  'vanaf € 55 per maand en dagelijks opzegbaar.', '€ 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting, en dagelijks opzegbaar.'),
  'Dit artikel is bedoeld als algemene informatie en is geen persoonlijk advies. Aan dit artikel kunnen geen rechten worden ontleend. Wil je weten wat past bij jouw situatie? Neem dan vrijblijvend contact op met ZP Zaken.',
  'Dit artikel is algemene informatie. Aan dit artikel kunnen geen rechten worden ontleend. Wat precies gedekt is, lees je in de polisvoorwaarden. Vragen? Neem vrijblijvend contact op met ZP Zaken.'),
  E'## Disclaimer', $t$## Veelgestelde vragen

**Heb ik een BAV en een AVB allebei nodig?**
Ze dekken verschillende schade: de BAV financiële schade door een fout in je werk, de AVB schade aan personen of spullen van anderen. Veel opdrachtgevers vragen beide. Bij ZP Zaken zitten ze samen in één polis.

**Hoe regel ik het bij ZP Zaken?**
Kies je pakket op [/verzekeringen](/verzekeringen), maandelijks of jaarlijks, eventueel met cyberdekking. Kies je ingangsdatum en vul je gegevens in. Binnen 24 uur geregeld: je certificaat staat in je mailbox.

**Vanaf wanneer ben ik verzekerd?**
Vanaf de ingangsdatum die je zelf kiest. Er is geen uitloop: na opzeggen ben je niet meer verzekerd voor nieuwe claims.

**Welke verzekeringen zijn er nog meer voor zzp'ers?**
Als zzp'er heb je geen werkgever die doorbetaalt bij ziekte. Daarom kijken veel zzp'ers ook naar een [arbeidsongeschiktheidsverzekering](/aov), naast hun pensioen en [zorgverzekering](/zorgverzekering). Een overzicht staat in [Welke verzekeringen heb je nodig als zzp'er?](/kennisbank/welke-verzekeringen-zzp)

## Disclaimer$t$),
 updated_at = now(), content_reviewed_at = now()
WHERE slug = 'bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt';

-- 2. VBAR
UPDATE public.articles SET
 content = replace(replace(replace(content,
  E'**Updates:**', $t$> **Stand van zaken oktober 2026**
> - **Rechtsvermoeden onder € 38 per uur:** op 16 juni 2026 aangenomen door de Eerste Kamer, ingang 31 december 2026.
> - **Verduidelijkingsdeel van de VBAR:** geschrapt.
> - **Zelfstandigenwet:** op 1 oktober 2026 gepresenteerd, in internetconsultatie tot en met 29 oktober 2026, ingang op zijn vroegst 1 januari 2028.
> - **Wet DBA:** blijft het kader; de Belastingdienst handhaaft sinds 1 januari 2025.

**Updates:**$t$),
  'Maar daar worden nu (eind 2024) al vraagtekens bij geplaatst. Er is namelijk veel kritiek op de wet, met name het stuk wat gaat over de beoordeling van de werkrelatie. Niet alleen vanuit het werkveld, maar ook vanuit de politiek zelf!',
  'Het voorstel kan na de consultatie en de behandeling in het parlement nog veranderen.'),
  E'## Meer relevante artikelen', $t$## Wat betekent dit voor je verzekering?

Opdrachtgevers vragen vaker om bewijs van zelfstandigheid: een goede opdrachtovereenkomst en een geldige beroepsaansprakelijkheidsverzekering (BAV). In het voorstel voor de Zelfstandigenwet staan de BAV en de AVB bij de voorzieningen tegen ondernemersrisico's die mogelijk meetellen. De definitieve lijst en het bedrag liggen nog niet vast.

- **BAV:** dekt financiële schade bij je opdrachtgever door een fout in je werk. Dat is precies het risico dat bij ondernemerschap hoort, en een polis laat zien dat je dat risico zelf draagt.
- **AVB:** dekt schade aan personen of spullen van anderen tijdens je werk. Een werknemer is via de werkgever verzekerd; als zzp'er regel je dit zelf.
- **AOV:** val je door ziekte uit, dan is er geen werkgever die doorbetaalt. Sommige opdrachtgevers, bijvoorbeeld in de zorg en bij de overheid, vragen ernaar.

Wat je nu al kunt doen:

1. **Zorg voor een goede opdrachtovereenkomst** waaruit blijkt dat je zelfstandig werkt en zelf risico draagt.
2. **Regel je verzekeringen.** Bij ZP Zaken zitten de BAV en AVB samen in één polis: € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting, per aanspraak, zonder eigen risico en dagelijks opzegbaar. Binnen 24 uur geregeld via [/verzekeringen](/verzekeringen).
3. **Houd de wet in de gaten.** Meer over de gevolgen voor je verzekering lees je in [Zelfstandigenwet en je verzekering](/kennisbank/zelfstandigenwet-verzekering-zzp).

## Meer relevante artikelen$t$),
 updated_at = now(), content_reviewed_at = now()
WHERE slug = 'vbar-wet-verduidelijking-arbeidsrelaties';

-- 3. Administratie
UPDATE public.articles SET
 content = replace(content, E'##### Een boekhouder inhuren: waar let je op?', $t$##### Boekhoudsoftware kiezen

Er zijn veel online boekhoudprogramma's voor zzp'ers. De meeste bieden facturen maken, bonnetjes en bankmutaties verwerken en de btw-aangifte rechtstreeks naar de Belastingdienst sturen. Ze verschillen in prijs, gebruiksgemak, koppelingen met je bank en ondersteuning. Veel pakketten hebben een gratis proefperiode, soms met een speciale regeling voor starters. Let ook op of je boekhouder kan meekijken in je administratie, en vergelijk een paar pakketten op de functies die jij nodig hebt.

##### Een boekhouder inhuren: waar let je op?$t$),
 updated_at = now(), content_reviewed_at = now()
WHERE slug = 'zzp-administratie-en-boekhouding';

-- 4. Welke verzekeringen
UPDATE public.articles SET
 content = replace(content, E'## **Waarvoor verzeker ik mij, als zzp’er?**', $t$## Starten als zzp'er

Start je net? Wettelijk verplicht zijn alleen je zorgverzekering en de volksverzekeringen, plus een WA-verzekering als je een bedrijfsauto hebt. Een BAV is alleen voor enkele beroepen wettelijk verplicht, maar veel opdrachtgevers vragen een BAV en een AVB, vaak met een bewijs van verzekering voordat je begint.

- **Wanneer regelen:** na je KVK-inschrijving en voor de startdatum van je eerste opdracht. Werk van voor de ingangsdatum is niet meeverzekerd.
- **Ingangsdatum:** die kies je zelf, tot maximaal 6 maanden vooruit. Je hebt wel een KVK-nummer nodig.
- **Startertarief:** met het [starterspakket](/starters) betaal je de eerste 12 maanden € 45 per maand of € 495 per jaar, daarna € 55 per maand of € 600 per jaar, inclusief kosten en assurantiebelasting. Dit geldt bij een KVK-inschrijving jonger dan 12 maanden, onder voorbehoud van controle van je KVK-inschrijvingsdatum.
- **Dekking:** BAV + AVB in één polis, per aanspraak, zonder eigen risico en dagelijks opzegbaar. Binnen 24 uur geregeld, certificaat in je mailbox.
- **Even geen opdracht:** zeg niet meteen op. Je kunt je polis via Mijn ZP pauzeren; tijdens de pauze ben je niet verzekerd voor nieuwe werkzaamheden. Er is geen uitloop: na opzeggen ben je niet meer verzekerd voor nieuwe claims.

Wat de Zelfstandigenwet voor je verzekering betekent, lees je in [Zelfstandigenwet en je verzekering](/kennisbank/zelfstandigenwet-verzekering-zzp).

## **Waarvoor verzeker ik mij, als zzp’er?**$t$),
 updated_at = now(), content_reviewed_at = now()
WHERE slug = 'welke-verzekeringen-zzp';

-- Bronnen uit publicatie (niet verwijderd)
UPDATE public.articles SET is_published = false
WHERE slug IN ('zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb','vbar-zzp-verzekering-gevolgen','boekhouding-zzp','starten-als-zzper-welke-verzekeringen');

-- Interne links naar bronnen
UPDATE public.articles SET content = replace(replace(replace(replace(replace(content,
  '[Starten als zzp''er in 2026: welke verzekeringen heb je nodig?](/kennisbank/starten-als-zzper-welke-verzekeringen)', '[Welke verzekeringen heb je nodig als zzp''er?](/kennisbank/welke-verzekeringen-zzp)'),
  '/kennisbank/starten-als-zzper-welke-verzekeringen', '/kennisbank/welke-verzekeringen-zzp'),
  '/kennisbank/zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb', '/kennisbank/bav-afsluiten-als-zzper-dit-is-waarom-en-hoe-je-het-regelt'),
  '/kennisbank/vbar-zzp-verzekering-gevolgen', '/kennisbank/vbar-wet-verduidelijking-arbeidsrelaties'),
  '/kennisbank/boekhouding-zzp)', '/kennisbank/zzp-administratie-en-boekhouding)'),
  updated_at = now()
WHERE is_published AND content ~ '(starten-als-zzper-welke-verzekeringen|zp-zaken-zorgeloos-zzpen-goedkoopste-bav-avb|vbar-zzp-verzekering-gevolgen|kennisbank/boekhouding-zzp\))';

-- goedkoopste
UPDATE public.articles SET content = replace(content, 'Waarom is de BAV + AVB van ZP Zaken niet de goedkoopste?', 'Waarom heeft de BAV + AVB van ZP Zaken niet de laagste premie?'), updated_at = now()
WHERE slug = 'wat-kosten-verzekeringen-voor-zzp-ers';

-- Onderscheiden paren
UPDATE public.articles SET title = 'Zelfstandigenwet: nieuws en stand van het wetsvoorstel (oktober 2026)',
 seo_title = 'Zelfstandigenwet: nieuws en stand van de wet | ZP Zaken',
 seo_description = 'Nieuws over de Zelfstandigenwet: de 7 criteria, de veilige haven, de consultatie tot 29 oktober 2026 en de beoogde ingang in 2028. De gevolgen voor je verzekering staan in een apart artikel.',
 updated_at = now() WHERE slug = 'zelfstandigenwet-voor-zzp-ers';
UPDATE public.articles SET title = 'Zelfstandigenwet en je verzekering: telt je BAV of AVB mee?',
 seo_title = 'Zelfstandigenwet: gevolgen voor je verzekering | ZP Zaken',
 seo_description = 'Wat betekent de Zelfstandigenwet voor je verzekeringen? Lees of je BAV, AVB of AOV meetelt als voorziening tegen ondernemersrisico. Het nieuws over de wet zelf staat in een apart artikel.',
 updated_at = now() WHERE slug = 'zelfstandigenwet-verzekering-zzp';
UPDATE public.articles SET title = 'Bedrijfsaansprakelijkheidsverzekering (AVB) voor zzp''ers: wat dekt het?',
 seo_title = 'AVB voor zzp''ers: wat dekt het? | ZP Zaken',
 seo_description = 'Alles over de AVB voor zzp''ers: schade aan personen of spullen van anderen, wat wel en niet gedekt is en waar je op let. Het verschil met een BAV lees je in een apart artikel.',
 content = replace(content, E'## Vragen?', E'Wil je weten hoe de AVB zich verhoudt tot de BAV? Lees [Verschil tussen BAV en AVB](/kennisbank/verschil-bav-avb-zzp).\n\n## Vragen?'),
 updated_at = now() WHERE slug = 'bedrijfsaansprakelijkheidsverzekering-zzp';
UPDATE public.articles SET title = 'Verschil tussen BAV en AVB voor zzp''ers: welke heb je nodig?',
 seo_title = 'Verschil BAV en AVB voor zzp''ers | ZP Zaken',
 seo_description = 'BAV of AVB? De twee aansprakelijkheidsverzekeringen naast elkaar: wat elk dekt, met voorbeelden en een overzichtstabel. Alles over de AVB zelf lees je in een apart artikel.',
 updated_at = now() WHERE slug = 'verschil-bav-avb-zzp';