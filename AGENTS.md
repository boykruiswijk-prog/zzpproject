# Technische afspraken
- Admin discovery uses the allowlisted admin_zoek_bronnen view behind the MFA-only zoek_universeel RPC; unlinked records open a read-only search-backed detail page, never arbitrary table fetches. Why: full discovery without exposing raw records.
- New article photos use a separate immutable photo registry and SQL publication gate, with bounded allowlisted downloads and exact/perceptual deduplication against an inventoried image set; legacy image URLs are preserved. Why: SQL-only content automation cannot publish reused or unvalidated photos.
- Dashboard application composition comes from tel_dashboard_opbouw/tel_aanvraag_cohort; the goal and conversion share KvK deduplication, and SQL plus payload validation reject mismatched totals. Lifecycle triggers synchronize only new activation/merge events, never historical bulk repairs. Why: reconciliation without mail or accounting effects.
- Both new-application and later-addition cyber consent SQL are generated from _shared/cyber.ts by scripts/cyberAkkoordSql.ts and parity-tested; historical evidence is immutable, and consent changes require an explicit register decision. Why: database evidence and displayed consent must follow the register, not certificate-only wording.
- Lovable-only robots/canonical enforcement runs in the early head script and survives head updates; never apply it to custom production hosts. Why: exclude duplicate published hosts without deindexing zpzaken.nl.
- Certificate previews execute the production PDF drawing block locally with a local template and fictitious fields, never the privileged handler; authorization, policy writes and mail stay untouched. Why: identical rendering, no customer effects.
- Later cyber uses Aanvragen, not goal/customer inflow. Separate MFA review, activation, PDF creation, Ellen's persisted PDF check and explicit sending; certificate before confirmation, durable claims, definitive failures retry manually, uncertain deliveries never retry. Test effects never call Exact/mail; planner tests use one marked contract. Why: no automatic mail, BAV change or duplicate effects.
- Application tabs exclude active policies only from the application To do view; SQL action counters exclude them from application work while retaining real policy-management actions. Why: archive access and shared admin/screen counts without status changes.
- Cyber only-test mode requires real human MFA approval and immutable pre-approval test snapshots; dry planner and mail evidence is isolated from production claims. Why: test database activation without Vault workarounds or customer effects.
- Certificate sending shares certificaatMail template/attachment logic between application and later cyber; later cyber claims its certificate independently before attachment-free confirmation. Why: same approved customer document route without duplicate mail.
- Vitest uses happy-dom for DOM tests; script rendering loads Satori through its CommonJS entry. Why: retain actual image rendering and avoid native canvas and harfbuzz ESM runtime failures.
- Application work descriptions share werkzaamheden.ts limits across forms and public handlers; manual approval uses generate-certificate, service-only leg_handmatige_acceptatie_vast (atomic metadata/audit) and immutable SEPA evidence; release checks successful mail logs by lead/evidence and existing invitations before effects, with read-only dry runs restricted to test leads; portal approval is explicit, never a fake Exact ID. Why: reject before writes and release only missing documents after human approval without changing billing.
- Evi access/discovery/robots use eviPagina.ts; hidden means preview-only, no prerender. Source stays separate from Ads. Why: one switch.
- New /aov (F9) uses aovPagina.ts: flag off shows AOVMovir only on preview hosts; SSR/prerender, sitemap and llms keep the old AOV page. The AOV page has no forms; all AOV actions link out to the licensed adviser. Why: no AFM licence for income insurance.
- F9 AOV: contact signup (name, email, optional phone, consent only) goes solely through RPC aov_aanmelden, which validates, rate-limits via form_rate_limit and inserts the matching aov_doorverwijzingen row with the same id as ref; direct referral clicks remain the minimal insert-only exception; admin reads/updates use has_role+aal2 RPCs; no automatic mails. Why: aanbrenger role without AFM income-insurance licence, no AOV content collected.

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
- Shared attribution validator: paid 90-day inheritance, boolean consent, utm_source=chatgpt/oppref = chatgpt_ads; ad pixels load from tracking.ts after marketing consent only. Why: no consent bypass.
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

- BeroepspaginaTekst links policy-condition mentions without changing FAQ strings; beroepspagina price display is opt-in by canonical path, leaving other services and form pricing untouched. Why: consistent landing-page copy with matching JSON-LD and no application changes.
- Bundle leak checks exempt only explicit public AVB coverage wording, including amount-before-AVB; unlabeled and cyber amounts remain blocked. Why: valid coverage copy must deploy.
- PageHero text wrapping is opt-in for occupational landing pages; other pages retain their existing sizing. Why: long coverage headings must remain readable without changing shared page layouts.
- Trigger artikel_hiscox_acceptatie_check plus hiscoxAcceptatie.test.ts reject text attributing acceptance to Hiscox. Why: automation cannot publish it.
- Ad images: SQL insert into advertentie_beelden wakes advertentie-beeld (empty body, host allowlist, cover-crop JPG); output in public article-images/ad-images/ because public buckets are blocked. Why: reusable for Ads agents without a new public bucket.
