# Technische afspraken
- New article photos use a separate immutable photo registry and SQL publication gate, with bounded allowlisted downloads and exact/perceptual deduplication against an inventoried image set; legacy image URLs are preserved. Why: SQL-only content automation cannot publish reused or unvalidated photos.
- Dashboard application composition comes from tel_dashboard_opbouw/tel_aanvraag_cohort; the goal and conversion share KvK deduplication, and SQL plus payload validation reject mismatched totals. Lifecycle triggers synchronize only new activation/merge events, never historical bulk repairs. Why: reconciliation without mail or accounting effects.
- Both new-application and later-addition cyber consent SQL are generated from _shared/cyber.ts by scripts/cyberAkkoordSql.ts and parity-tested; historical evidence is immutable, and consent changes require an explicit register decision. Why: database evidence and displayed consent must follow the register, not certificate-only wording.
- Lovable-only robots/canonical enforcement runs in the early head script and survives head updates; never apply it to custom production hosts. Why: exclude duplicate published hosts without deindexing zpzaken.nl.
- Later cyber uses Aanvragen, not goal/customer inflow. Separate MFA review, activation, PDF creation, Ellen's persisted PDF check and explicit sending; certificate before confirmation, durable claims, definitive failures retry manually, uncertain deliveries never retry. Test effects never call Exact/mail; planner tests use one marked contract. Why: no automatic mail, BAV change or duplicate effects.
- Cyber only-test mode requires real human MFA approval and immutable pre-approval test snapshots; dry planner and mail evidence is isolated from production claims. Why: test database activation without Vault workarounds or customer effects.
- Vitest uses happy-dom for DOM tests; script rendering loads Satori through its CommonJS entry. Why: retain actual image rendering and avoid native canvas and harfbuzz ESM runtime failures.
- Work descriptions share werkzaamheden.ts limits (forms and handlers); manual approval uses generate-certificate, service-only leg_handmatige_acceptatie_vast (atomic audit) and immutable SEPA evidence; release checks mail logs and invitations before effects, dry runs only on test leads; explicit portal approval, never a fake Exact ID. Why: release only missing documents after human approval, billing unchanged.
- Evi access/discovery/robots use eviPagina.ts; hidden means preview-only, no prerender. Source stays separate from Ads. Why: one switch.
- AOV uses aovPagina.ts; the tool mounts after consent signup with its ref and accepts bounded height messages only from its own exact-origin frame. CSP frame-src: that host plus blob: (admin PDFs via PdfWeergave). AOV-only daily retention anonymizes in place; team handling conservatively extends the contact clock. Why: preserve privacy, counts and external input isolation.
- F9 AOV: contact signup (name, email, optional phone, consent) only via RPC aov_aanmelden (validates, form_rate_limit, inserts aov_doorverwijzingen with id = ref); referral clicks stay the minimal insert-only exception; admin uses has_role+aal2 RPCs; no automatic mails. Why: aanbrenger without AFM AOV licence.

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

- Bezoekersinvoer in leads.extra_data.formulier (geordende lijst) via _shared/leadVelden.ts voor detail, lijst en teammail; preview-inzendingen zijn is_test zonder klantmail. Waarom: één bron.
- Shared attribution validator: paid 90-day inheritance, boolean consent, utm_source=chatgpt/oppref = chatgpt_ads; ad pixels load from tracking.ts after marketing consent only. OpenAI uses measure/page_viewed/contents per SPA navigation and measure/lead_created/customer_action after success, with its official q queue and no customer fields. Why: no consent bypass or dropped pre-load events.
- Halve BAV-aanvragen staan in aanvraag_concepten, alleen geschreven via submit-public-form (table "aanvraag_concepten", idempotent op browser-concept-id) en omgezet door process-bav-wizard; nooit bank-/SEPA-velden, na 90 dagen geanonimiseerd (cron), nooit verwijderd. Waarom: opvolging zonder gevoelige gegevens of anon-toegang.
- BAV-vergelijking in src/data/bavVergelijking.ts (bron-URL + gecontroleerd_op per aanbieder; ZP-rij uit bavPakketten). Waarom: bijwerken zonder paginacode.
- CSV mirrors _redirects, including slash variants and suffix-preserving internal language redirects; news fallbacks include language prefixes, after all explicit rules in generated output. src/assets use hashed stubs and glob fallback. Why: preserve specific destinations without false 404s.
- Bulk CSV exports exact thank-you URLs; hyphen-prefix wildcards require a Cloudflare Single Redirect, never a fake CSV row. Why: Bulk supports subpaths, not segment wildcards.

- Submappen hebben eigen AGENTS.md (src/components/admin, crm, supabase/functions); lees die eerst.
- Scripts never import React (SSR crashes); markdown uses articleMarkdownUrl (safe tel: links). Both llms generators use published articles. Why: current article discovery.
- Public combined cyber coverage/help uses cyberPubliek.CYBER_DEKKING_EN_HULP; shared contractual constants stay unchanged. Why: consistent punctuation without altering consent, mail or certificate text.

- Elke zichtbare website/admin-wijziging krijgt bij publiceren precies één rij in public.wijzigingsmeldingen in gewone taal voor Ellen; trigger wijzigingsmelding_mailen plus cron-vangnet mailen via wijziging-mailen. Waarom: Ellen weet wat er veranderd is.

<!-- LOVABLE:BEGIN -->
- Live scenes/effects are lazy; demo events stay in browser memory. Journey/timeline aggregates use service-only scherm_stromen via scherm-data. Why: site performance and visitor privacy.
<!-- LOVABLE:END -->
- Samengevoegd artikel: bron is_published=false + rij article_samenvoegingen + directe 301's; bewaakt door kennisbankSamenvoeging.test.ts. Waarom: niets verwijderen, geen ketens.
- Ingangsdatum vroegst dag na aanvraag (NL) via _shared/ingangsdatum.ts plus BEFORE INSERT-triggers aa_ingangsdatum_vroegst. Waarom: een regel (D4).

- BeroepspaginaTekst links policy-condition mentions without changing FAQ strings; beroepspagina price display is opt-in by canonical path, leaving other services and form pricing untouched. Why: consistent landing-page copy with matching JSON-LD and no application changes.
- Bundle leak checks exempt only explicit public AVB coverage wording, including amount-before-AVB; unlabeled and cyber amounts remain blocked. Why: valid coverage copy must deploy.
- PageHero text wrapping is opt-in for occupational landing pages; other pages retain their existing sizing. Why: long coverage headings must remain readable without changing shared page layouts.
- Trigger artikel_hiscox_acceptatie_check plus hiscoxAcceptatie.test.ts reject text attributing acceptance to Hiscox. Why: automation cannot publish it.
- A20 afhaakmail: alleen via afhaak_herinnering_kandidaten/_claim, geclaimd nooit opnieuw; enhanced conversions alleen browser-SHA-256 e-mail. Waarom: geen dubbele mail of leesbare data.
- Policies without a lead (policies.onderneming_id) are linked to the onderneming's single confirmed portal account by trigger policies_onderneming_portal_user and at invite; Mijn ZP falls back to RPC mijn_klant_contracten for contracts without a policy. Why: pre-online customers must see their certificate after login.
- Article-to-landing links: src/data/artikelInterneLinks.ts, rendered by ArtikelDetail, never article content. Why: ships only on publish.
- Cyber documents share cyberDocumenten.ts with hash-tested static PDFs; public links use cyberPubliek.ts and CyberVoorwaardenTekst, contractual constants stay unchanged. Why: one verified document source.
- Cyber team requests may have no portal user; customer requests require one. Existing contact lookup and ID-based claims remain authoritative. Why: no fake account or broader customer access.
- Homepage title stays exact in SEOHead and prerender; metadata titles share it. Why: retain register wording.
- Every fix gets a rollback scenario (SQL test_scenario or src/test/scenarios1211.test.ts); see docs/scenariotests.md. Why: test without leaving data.
