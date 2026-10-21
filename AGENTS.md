# Technische afspraken
- Evi access/discovery/robots use eviPagina.ts; hidden means preview-only, no prerender. Source stays separate from Ads. Why: one switch.

- ZP icons (ICO, embedded-PNG SVG, PNG and both manifests) share versioned head links in pages and redirect stubs; static assets precede the unforced SPA fallback. Why: consistent brand and crawler access.
- Derive ZP icons from docs/brand/favicon.png.b64 or public/favicon-192x192.png, without redrawing/cropping. Why: preserve the approved mark.
- No former-employee photos; doubtful photos are removed. New people photos need Boy's approval. Why: portrait rights, A9.

- SEPA-tekst staat byte-gelijk in frontend en _shared/sepaMachtiging.ts; bewijs is onveranderbaar.
- Portal user/policy linking, magic links and mail/log use _shared/portalAccess.ts; customers read leads only via get_mijn_polissen RPC. Why: one access path, no customer SELECT.

## Beveiligingsarchitectuur

- Public forms write only via validated Edge Functions; anon has no direct table grants. Why: usable forms without public personal data.
- Exact-verwerking voor screening wordt nooit vanuit de openbare formulierfunctie uitgevoerd. Waarom: boekhoudmutaties vereisen een afzonderlijke beveiligde teamactie.
- Security-definerfuncties krijgen minimale EXECUTE-rechten; alleen expliciete publieke leesfuncties blijven voor anon beschikbaar. Waarom: privilege-escalatie via RPC voorkomen.
- Policies met rolfuncties gelden alleen `TO authenticated`; publieke leespolicies gebruiken geen rolfunctie. Controle: scripts/check-anon-kennisbank.mjs.
- Prerender via entry-server.tsx; root article 301s/stubs share the sitemap list; router/SEO routes, existing redirects and /tv win; wildcards last, no stub. Why: safe WordPress URLs on static hosting.
- 404's alleen via RPC log_not_found (begrensd optellen). Waarom: geen anonieme tabelrechten.
- Testdata wordt gemarkeerd met kolom is_test (nooit verwijderd); beheeroverzichten filteren is_test standaard weg, alleen admin/supervisor kan via useToonTestrecords tonen. Leadstatuslabels komen uit src/lib/statusLabels.ts. Waarom: herleidbare historie en één bron voor labels.
- Collectieve aanmeldtellingen alleen in beheer, nooit publiek. Waarom: geen misleidende sociale bewijslast.
- Opzegregels (toelichting bij "Anders" 3-500 tekens, datum vandaag tot 180 dagen, NL-tijd) staan in src/lib/opzegValidatie.ts, byte-gelijk in _shared/opzegValidatie.ts. Waarom: formulier en server hanteren exact dezelfde regels.

- Opzeggingen worden bij insert gekoppeld door bepaal_opzegging_koppeling (e-mail → contractnummer → KvK/bedrijfsnaam als voorstel); contracten wijzigen alleen via RPC verwerk_opzegging. Waarom: nooit automatisch een contract beëindigen.
- Bezoekersinvoer in leads.extra_data.formulier (geordende lijst) via _shared/leadVelden.ts voor detail, lijst en teammail; preview-inzendingen zijn is_test zonder klantmail. Waarom: één bron.
- Attribution uses the shared validator: direct sessions inherit paid 90-day fields, explicit session sources win, consent is boolean; Ads requires a valid label. Why: consistent attribution without consent bypass.
- Halve BAV-aanvragen staan in aanvraag_concepten, alleen geschreven via submit-public-form (table "aanvraag_concepten", idempotent op browser-concept-id) en omgezet door process-bav-wizard; nooit bank-/SEPA-velden, na 90 dagen geanonimiseerd (cron), nooit verwijderd. Waarom: opvolging zonder gevoelige gegevens of anon-toegang.
- BAV-vergelijking in src/data/bavVergelijking.ts (bron-URL + gecontroleerd_op per aanbieder; ZP-rij uit bavPakketten). Waarom: bijwerken zonder paginacode.
- CSV follows _redirects at build; profile/* and facts/press/* match subpaths without suffix; new paths get slash variants. Why: one source, no chains.

- Submappen hebben eigen AGENTS.md (src/components/admin, crm, supabase/functions); lees die eerst.
- Scripts never import React (SSR crashes); markdown uses articleMarkdownUrl (safe tel: links). Both llms generators use published articles. Why: current article discovery.

- Elke wijziging die zichtbaar is op de website of in de admin krijgt bij het publiceren precies één rij in public.wijzigingsmeldingen, in gewone taal voor Ellen (geen technische termen of bestandsnamen); de trigger wijzigingsmelding_mailen en het vangnet (cron) mailen via Edge Function wijziging-mailen. Waarom: Ellen weet altijd wat er veranderd is.
- /scherm en /tv: data alleen via scherm-data (SCHERM_TOKEN of apparaattoken, alleen sha-256 in scherm_apparaten; koppelen via scherm-koppel); machine_activiteit-triggers laten nooit de actie falen; fout = cache met X-Cache stale + verouderd_sinds; pagina herlaadt bij nieuwe build (src/lib/versieControle.ts). Waarom: intrekbare toegang, stilstand zichtbaar.

<!-- LOVABLE:BEGIN -->
- Live scenes/effects are lazy; demo events stay in browser memory. Journey/timeline aggregates use service-only scherm_stromen via scherm-data. Why: site performance and visitor privacy.
<!-- LOVABLE:END -->
- Samengevoegd artikel: bron is_published=false + rij article_samenvoegingen + directe 301's; bewaakt door kennisbankSamenvoeging.test.ts. Waarom: niets verwijderen, geen ketens.
- Ingangsdatum vroegst dag na aanvraag (NL) via _shared/ingangsdatum.ts plus BEFORE INSERT-triggers aa_ingangsdatum_vroegst. Waarom: een regel (D4).
