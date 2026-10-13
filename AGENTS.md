# Technische afspraken

- ZP icons (ICO, PNG, manifest) share head links in pages and redirect stubs. Why: consistent brand.
- No former-employee photos; doubtful photos are removed. New people photos need Boy's approval. Why: portrait rights, A9.

- SEPA-tekst staat byte-gelijk in frontend en _shared/sepaMachtiging.ts; bewijs is onveranderbaar.
- Portal access (create user, link policies, magic link, mail/log) uses _shared/portalAccess.ts; customers read lead fields only via get_mijn_polissen RPC. Why: one access path, no customer SELECT on leads.

## Beveiligingsarchitectuur

- Public forms write only via validated Edge Functions; anon has no direct table grants. Why: usable forms without public personal data.
- Exact-verwerking voor screening wordt nooit vanuit de openbare formulierfunctie uitgevoerd. Waarom: boekhoudmutaties vereisen een afzonderlijke beveiligde teamactie.
- Security-definerfuncties krijgen minimale EXECUTE-rechten; alleen expliciete publieke leesfuncties blijven voor anon beschikbaar. Waarom: privilege-escalatie via RPC voorkomen.
- Policies met rolfuncties gelden alleen `TO authenticated`; publieke leespolicies gebruiken geen rolfunctie. Controle: scripts/check-anon-kennisbank.mjs.
- Prerender rendert elke publieke route volledig via src/entry-server.tsx (AppRoutes + vooraf gevulde querydata); oude URL's uit src/config/legacyRedirects.ts (gespiegeld in _shared) en artikel-slugs krijgen noindex-doorverwijspagina's. Waarom: hosting kent geen SSR, 301 of 404.
- 404's alleen via RPC log_not_found (begrensd optellen). Waarom: geen anonieme tabelrechten.
- Testdata wordt gemarkeerd met kolom is_test (nooit verwijderd); beheeroverzichten filteren is_test standaard weg, alleen admin/supervisor kan via useToonTestrecords tonen. Leadstatuslabels komen uit src/lib/statusLabels.ts. Waarom: herleidbare historie en één bron voor labels.
- Collectieve aanmeldtellingen alleen in beheer, nooit publiek. Waarom: geen misleidende sociale bewijslast.
- Opzegregels (toelichting bij "Anders" 3-500 tekens, datum vandaag tot 180 dagen, NL-tijd) staan in src/lib/opzegValidatie.ts, byte-gelijk in _shared/opzegValidatie.ts. Waarom: formulier en server hanteren exact dezelfde regels.

- Opzeggingen worden bij insert gekoppeld door bepaal_opzegging_koppeling (e-mail → contractnummer → KvK/bedrijfsnaam als voorstel); contracten wijzigen alleen via RPC verwerk_opzegging. Waarom: nooit automatisch een contract beëindigen.
- Bezoekersinvoer in leads.extra_data.formulier (geordende lijst) via _shared/leadVelden.ts voor detail, lijst en teammail; preview-inzendingen zijn is_test zonder klantmail. Waarom: één bron.
- Leadherkomst via _shared/attributie.ts (sessionStorage, src/lib/attributie.ts) → leads.extra_data.attributie; GA4-events alleen via src/lib/tracking.ts, tel:/wa.me-klikken via één globale listener, geen GA4 op /admin, /portal, /mijn-zp (ga-disable-vlag). Waarom: één meetbron zonder dubbele events of interne vervuiling.
- Halve BAV-aanvragen staan in aanvraag_concepten, alleen geschreven via submit-public-form (table "aanvraag_concepten", idempotent op browser-concept-id) en omgezet door process-bav-wizard; nooit bank-/SEPA-velden, na 90 dagen geanonimiseerd (cron), nooit verwijderd. Waarom: opvolging zonder gevoelige gegevens of anon-toegang.
- BAV-vergelijking in src/data/bavVergelijking.ts (bron-URL + gecontroleerd_op per aanbieder; ZP-rij uit bavPakketten). Waarom: bijwerken zonder paginacode.
- docs/cloudflare-bulk-redirects.csv volgt bij elke build uit public/_redirects. Waarom: één bron.

- Reviewverzoeken alleen via review-verzoeken (cron, schakelaar 'reviewverzoeken_actief', RPC review_kandidaten); afmelden alleen naar review_afmeldingen, nooit suppressed_emails. Waarom: één filter, transactionele mail blijft.
- Submappen hebben eigen AGENTS.md (src/components/admin, crm, supabase/functions); lees die eerst.
- Scripts never import React (SSR crashes); article markdown always uses articleMarkdownUrl (keeps tel: links, filters unsafe protocols).

- Elke wijziging die zichtbaar is op de website of in de admin krijgt bij het publiceren precies één rij in public.wijzigingsmeldingen, in gewone taal voor Ellen (geen technische termen of bestandsnamen); de trigger wijzigingsmelding_mailen en het vangnet (cron) mailen via Edge Function wijziging-mailen. Waarom: Ellen weet altijd wat er veranderd is.
- /scherm en /tv: data alleen via scherm-data (SCHERM_TOKEN of apparaattoken, alleen sha-256 in scherm_apparaten; koppelen via scherm-koppel); machine_activiteit-triggers laten nooit de actie falen; fout = cache met X-Cache stale + verouderd_sinds; pagina herlaadt bij nieuwe build (src/lib/versieControle.ts). Waarom: intrekbare toegang, stilstand zichtbaar.

<!-- LOVABLE:BEGIN -->
- Live scenes/effects are lazy; demo events stay in browser memory. Journey/timeline aggregates use service-only scherm_stromen via scherm-data. Why: site performance and visitor privacy.
<!-- LOVABLE:END -->
- Samengevoegd artikel: bron is_published=false + rij article_samenvoegingen + directe 301's; bewaakt door kennisbankSamenvoeging.test.ts. Waarom: niets verwijderen, geen ketens.
- Ingangsdatum vroegst dag na aanvraag (NL) alleen via _shared/ingangsdatum.ts (src/lib/ingangsdatum.ts) plus BEFORE INSERT-triggers aa_ingangsdatum_vroegst; server corrigeert, RPC en activeren weigeren. Waarom: een regel overal (D4).
