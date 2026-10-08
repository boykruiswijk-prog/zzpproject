# Technische afspraken

- SEPA-tekst staat byte-gelijk in frontend en _shared/sepaMachtiging.ts; bewijs is onveranderbaar.
- Portal access (create user, link policies, magic link, mail/log) uses _shared/portalAccess.ts; customers read lead fields only via get_mijn_polissen RPC. Why: one access path, no customer SELECT on leads.
- BAV-AVB-factuurteksten en YourRef lopen via _shared/factuurTekst.ts; periode vooraan, maximaal 60 tekens.
- BAV-sector → adminbranche loopt via _shared/sectorBranche.ts; het sectorlabel blijft in extra_data. Waarom: vaste waarden zonder informatieverlies.
- Intakeadres via _shared/adresNormalisatie.ts vóór legBewijsVast. Waarom: overal hetzelfde adres.

## Beveiligingsarchitectuur

- Public forms write only via validated Edge Functions; anon has no direct table grants. Why: usable forms without public personal data.
- Exact-verwerking voor screening wordt nooit vanuit de openbare formulierfunctie uitgevoerd. Waarom: boekhoudmutaties vereisen een afzonderlijke beveiligde teamactie.
- Security-definerfuncties krijgen minimale EXECUTE-rechten; alleen expliciete publieke leesfuncties blijven voor anon beschikbaar. Waarom: privilege-escalatie via RPC voorkomen.
- Policies met rolfuncties gelden alleen `TO authenticated`; publieke leespolicies gebruiken geen rolfunctie. Controle: scripts/check-anon-kennisbank.mjs.
- Prerender rendert elke publieke route volledig via src/entry-server.tsx (AppRoutes + vooraf gevulde querydata); oude URL's uit src/config/legacyRedirects.ts (gespiegeld in _shared) en artikel-slugs krijgen noindex-doorverwijspagina's. Waarom: hosting kent geen SSR, 301 of 404.
- 404's worden alleen via RPC log_not_found vastgelegd (alleen optellen, begrensd). Waarom: monitoring zonder anonieme tabelrechten.
- Testdata wordt gemarkeerd met kolom is_test (nooit verwijderd); beheeroverzichten filteren is_test standaard weg, alleen admin/supervisor kan via useToonTestrecords tonen. Leadstatuslabels komen uit src/lib/statusLabels.ts. Waarom: herleidbare historie en één bron voor labels.
- Collectieve aanmeldtellingen alleen in afgeschermd beheer; publiek geen aantallen of voortgang. Waarom: geen misleidende sociale bewijslast.
- Opzegregels (toelichting bij "Anders" 3-500 tekens, datum vandaag tot 180 dagen, NL-tijd) staan in src/lib/opzegValidatie.ts, byte-gelijk in _shared/opzegValidatie.ts. Waarom: formulier en server hanteren exact dezelfde regels.

- Opzeggingen worden bij insert gekoppeld door bepaal_opzegging_koppeling (e-mail → contractnummer → KvK/bedrijfsnaam als voorstel); contracten wijzigen alleen via RPC verwerk_opzegging. Waarom: nooit automatisch een contract beëindigen.
- Bezoekersinvoer in leads.extra_data.formulier (geordende lijst) via _shared/leadVelden.ts voor detail, lijst en teammail; preview-inzendingen zijn is_test zonder klantmail. Waarom: één bron.
- Leadherkomst via _shared/attributie.ts (sessionStorage, src/lib/attributie.ts) → leads.extra_data.attributie; GA4-events alleen via src/lib/tracking.ts, tel:/wa.me-klikken via één globale listener, geen GA4 op /admin, /portal, /mijn-zp (ga-disable-vlag). Waarom: één meetbron zonder dubbele events of interne vervuiling.
- Telefoonvalidatie/-normalisatie via _shared/telefoon.ts. Waarom: formulier en server hanteren hetzelfde formaat.
- Halve BAV-aanvragen staan in aanvraag_concepten, alleen geschreven via submit-public-form (table "aanvraag_concepten", idempotent op browser-concept-id) en omgezet door process-bav-wizard; nooit bank-/SEPA-velden, na 90 dagen geanonimiseerd (cron), nooit verwijderd. Waarom: opvolging zonder gevoelige gegevens of anon-toegang.
- Concurrentievergelijking BAV staat in src/data/bavVergelijking.ts (per aanbieder bron-URL + gecontroleerd_op); de ZP Zaken-rij komt uit bavPakketten. Waarom: per kwartaal bij te werken zonder pagina-code te wijzigen.
- docs/cloudflare-bulk-redirects.csv wordt bij elke build afgeleid van public/_redirects (cloudflareBulkCsv in vite.config.ts). Waarom: één bron voor redirects.

- Reviewverzoeken aan nieuwe klanten lopen alleen via Edge Function review-verzoeken (cron, schakelaar integratie_config 'reviewverzoeken_actief', kandidaten via RPC review_kandidaten); klikken via review-klik, afmelden via review-afmelden alleen naar review_afmeldingen (nooit suppressed_emails, zodat transactionele mail doorgaat). Waarom: één filter dat testleads en bestaande klanten uitsluit.
- Beheer-UI-regels staan in src/components/admin/AGENTS.md, CRM-regels in src/components/admin/crm/AGENTS.md.
- Article images: leased queue, wake token or MFA supervisor, max 2 AI attempts then category fallback; never a global pause (AI refusal only sets admin notice); crashed jobs resume as fallback. Preserve custom/old assets; build verifies images; keep ArticleImage guard. Why: every article gets an image within minutes.
- Scripts never import React. Why: avoid prod/dev SSR crashes.

- Monthly lifecycle/preview credits read actual invoiced periods via _shared/lifecycleCredit.ts and planner helper berekenOpzegCredit. Why: no annual-premium math or duplicate refunds.
