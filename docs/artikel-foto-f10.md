# E7 en F10, 26 oktober 2026

## Cyberteksten
- `/kennisbank/cyberverzekering-zzp`: aanvraagblok gewijzigd naar **BAV + AVB: geen eigen risico, dagelijks opzegbaar.**
- `/bav-zzp-vergelijken`, Waarom zzp'ers voor ZP Zaken kiezen: de volledige vaste cyberzin stond al goed en is behouden.
- Artikelen (66 rijen), vaste pagina's, FAQ's, schema, Mijn ZP, mailbronnen, llms.txt, llms-full.txt en cybercertificaat gecontroleerd: geen oude cyberdekkingsgebiedvariant aangetroffen. Europa was al ingesteld; geen onnodige inhoudswijzigingen.
- Acceptatievraag over omzet uit de VS of Canada is geen dekkingsgebied en blijft ongewijzigd. BAV/AVB-gebied blijft ongewijzigd.

## Contentmachine SQL
Gebruik een bevoegde SQL-schrijfsessie. Geen browser/anonrechten voor de fotoregisters. De statusfunctie is ook beschikbaar voor de bestaande read-only SQL-machine-identiteit.

```sql
INSERT INTO public.articles (
  slug, title, excerpt, content, category, published_at,
  foto_bron_url, foto_prompt, foto_alt, is_published, is_test
) VALUES (
  'unieke-artikel-slug', 'Titel', 'Samenvatting', 'Artikelinhoud',
  'Ondernemen', '2026-10-27 12:00:00 Europe/Amsterdam',
  'https://cdn.higgsfield.ai/PAD-NAAR-EIGEN-GELICENTIEERDE-FOTO.jpg',
  'De gebruikte Higgsfield-prompt', 'Concrete beschrijving van de foto',
  false, false
) RETURNING id, slug;

-- Poll met een korte pauze, bijvoorbeeld 10 seconden, tot klaar/geweigerd.
-- Een wachtende opdracht wordt hierbij opnieuw gewekt als de lease verlopen is.
SELECT * FROM public.artikel_foto_status('unieke-artikel-slug');

-- Alleen uitvoeren nadat status klaar is en de redactie de foto goedkeurt.
UPDATE public.articles
SET is_published = true
WHERE slug = 'unieke-artikel-slug' AND is_test = false;

-- Bij weigering: lever een werkelijk andere foto aan. Oude log blijft bestaan.
UPDATE public.articles
SET foto_bron_url = 'https://cdn.higgsfield.ai/ANDERE-EIGEN-FOTO.webp',
    foto_prompt = 'Nieuwe prompt', foto_alt = 'Nieuwe beschrijving'
WHERE slug = 'unieke-artikel-slug' AND image_url IS NULL
  AND is_published = false;
```

## Host-allowlist
- `cdn.higgsfield.ai`
- `static-public-media.higgsfield.ai`
- `static.higgsfield.ai`

Exacte hosts, uitsluitend HTTPS/443, geen gebruikersinfo en geen redirects. Geen generieke `*.cloudfront.net`-toegang: die zou ook willekeurige derde partijen toelaten. Een specifieke andere CDN-host kan na verificatie expliciet worden toegevoegd.

## Werking
- `artikel_fotos`: onveranderlijke geslaagde registraties, unieke SHA256, bron-SHA256, 64-bit DCT-pHash, bronhost, opslagpad, formaat en prompt.
- Downloads maximaal 15 MiB; JPEG/PNG/WebP, maximaal 12 miljoen pixels voor nieuwe import. Geen geanimeerde WebP.
- Lichte Photon WASM-conversie: WebP 1600 pixels breed en midden uitgesneden OG van 1200x630. SHA256 van uitvoer en bron; pHash-afstand <=8 wordt geweigerd.
- 54 huidige artikelbeelden en 92 bestaande projectbeelden geïnventariseerd zonder afbeeldingen te veranderen. Nieuwe bestaande artikel-URL's worden eerst bijgewerkt in de inventaris; import wacht totdat deze compleet is.
- Registry + artikel-URL + status atomair vastgelegd, met lease en globale ontdubbellock. Bestaande afbeelding nooit vervangen; fouten houden nieuwe image_url leeg en krijgen eigen log.
- Vanaf 27 oktober 00:00 Europe/Amsterdam blokkeert de database publicatie zonder bijbehorende niet-testfotoregistratie. Buildcontrole vereist foto en bereikbaar OG. Oude artikelen behouden hun afbeelding.
- Alleen lege wake-body; geen URL/prompt van HTTP-aanroeper. SQL-enqueue-trigger start de functie; statuspoll herwekt afgebroken opdrachten. Geen nieuwe cron-secret of permanent pollende cronjob. De aanvankelijk geweigerde Vault-route is niet gebruikt.
- Foto-alttekst komt uit `foto_alt`; overzichten en artikelpagina gebruiken object-cover, OG gebruikt `-og.webp`.

## Bewijs
- 41 gerichte cyber/foto/SQL-regressietests groen; 83 MFA-inventaristests groen.
- Deno controle foto-handler groen; live OPTIONS 200, invoer-POST 400.
- Test `test-f10-foto-20261026`: live opslag 1600x901 + OG 1200x630, status klaar. Publiek Higgsfield-promobeeld alleen technische test.
- Test `test-f10-dubbele-foto-20261026`: status geweigerd, reden **Foto geweigerd: identieke foto bestaat al**, image_url leeg.
- Test `test-f10-stoelfoto-20261026`: echte stoel-fotovariant zonder personen, status klaar, bronhost cdn.higgsfield.ai. Alle drie blijven is_test=true/is_published=false; geen productiegebruik/licentieclaim.
- Database-regressies draaien echte SQL: identieke hash en bijna-dubbele hash geweigerd, publicatie zonder foto geweigerd, oud artikel behouden, illustratiewachtrij niet gestart.
- Functies artikel-foto en artikel-afbeelding gedeployed. Publicatie aangevraagd; productie cyberartikel HTTP 200 en nieuwe CTA teruggelezen.

## Grenzen
SQL-publicaties houden de fotoregistratie aan; een later los ingevoegde afbeelding elders op de site kan een bestaande artikelfoto alsnog hergebruiken. De contentmachine moet alleen eigen gelicentieerde Higgsfield-uitvoer aanleveren en redactioneel op inhoud controleren; de import controleert bestandsveiligheid en beeldgelijkenis, niet beeldrechten of inhoudelijke passendheid.