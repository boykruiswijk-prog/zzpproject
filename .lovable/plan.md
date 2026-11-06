# Nachtelijke beveiligingsscan 6-11-2026 (alleen rapport, niets gewijzigd)

## 1. Kwetsbaarheden in pakketten
Bron: advisory-scan op bun.lock, alleen productie (76 pakketten). `npm audit` inclusief dev kon niet draaien omdat die een lockbestand wegschrijft; dev-pakketten zijn dus NIET gescand. De scan geeft geen GHSA/CVE-nummers terug, alleen de advisorytitel; waar hieronder geen ID staat, is die niet geverifieerd.

Totaal: critical 0, high 6, moderate 18, low 0.

| Kwetsbaar pakket (via) | Ernst | Advisory | Opgelost in | Soort update | Direct/transitief |
|---|---|---|---|---|---|
| prosemirror-view (via @tiptap/pm, @tiptap/starter-kit 3.31.3) | high | XSS bij plakken | 1.42.3 | waarschijnlijk minor (tiptap 3.33) | transitief |
| dompurify (via jspdf 4.2.1) | 1 high, 13 moderate | XSS / sanitizer-bypasses / prototype pollution | >3.4.16 | patch/minor in dompurify, jspdf-versie onbekend | transitief |
| fflate (via jspdf) | moderate | oneindige lus bij ZIP64 | 0.8.3 | patch | transitief |
| markdown-it (via tiptap-markdown 0.9.0) | 2 high, 1 moderate | kwadratische rekentijd (DoS) | 14.3.3 | patch binnen 14.x | transitief |
| zod 3.25.76 | high | geheugenuitputting bij grote collecties | 4.6.6 | major | direct |
| react-router (via react-router-dom 6.30.6) | 2 moderate | constructor-injectie bij SSR-hydratie; open redirect via backslash (CVE-2025-68470-bypass) | 7.18.0 | major | transitief via direct pakket |

## 2. Verouderde pakketten (npm outdated, 92 stuks)
- Patch (10): @electric-sql/pglite 0.5.11→0.5.15, @radix-ui/react-label 2.1.7→2.1.17, @tailwindcss/typography 0.5.16→0.5.20, @testing-library/react 16.3.1→16.3.3, drizzle-kit 0.31.10→0.31.11, drizzle-orm 0.45.2→0.45.4, jspdf-autotable 5.0.7→5.0.9, postcss 8.5.6→8.5.32, postprocessing 6.39.5→6.39.6, sharp 0.35.4→0.35.5.
- Minor (ca. 45): alle overige @radix-ui (bijv. dialog 1.1.14→1.3.1, select 2.2.5→2.4.1), @supabase/supabase-js 2.108.2→2.119.0, @tanstack/react-query 5.83.0→5.106.1, @tiptap/* 3.31.3→3.33.0, three/@types/three 0.160→0.187, react-hook-form 7.61.1→7.91.0, typescript-eslint 8.38→8.72.1, autoprefixer, fuse.js, input-otp, mammoth 1.12.3→1.13.0, next-themes 0.3→0.4.6, satori 0.35→0.63.2, lovable-tagger, eslint-plugin-react-refresh, i18next-browser-languagedetector.
- Major (ca. 37): react/react-dom 18→19, react-router-dom 6→7, zod 3→4, vite 7→8, vitest 3→5, tailwindcss 3→4, typescript 5→7, eslint 9→10, framer-motion 11→14, lucide-react 0.462→1.69, date-fns 3→4, pdfjs-dist 4→6, @hookform/resolvers 3→7, @react-three/* , jsdom 20→31, happy-dom 20→21, sonner 1→2, tailwind-merge 2→3, react-day-picker 8→10, react-resizable-panels 2→4, react-helmet-async 2→3, i18next 25→26, react-i18next 16→17, htmlparser2 10→12, postgres 3→4, vaul, globals, @types/node/react/react-dom, @vitejs/plugin-react-swc, @testing-library/jest-dom, eslint-plugin-react-hooks.

## 3. Database-linter (213 meldingen)
- WARN, functies die ingelogde gebruikers kunnen uitvoeren (security definer): 173. Meestal bewust, met interne rolcontrole; niet per functie nagelopen.
- WARN, functies die anon kan uitvoeren (7): verify_dba_certificate, log_not_found, site_bezoek, aov_aanmelden (bewust publiek), policies_onderneming_portal_user, aanvraag_afronden_bij_certificaatmail, generate_certificate_number. De laatste drie lijken triggerfuncties/intern en verdienen een controle.
- WARN, search_path niet vast (3): machine_cron_station, machine_cron_naam, incasso_welke_stap.
- WARN, extensie in public (1): pg_net.
- INFO, RLS aan zonder policy (29; 22 in public): o.a. kvk_opvraag_claim, machine_cron_stand, admin_teller_historie, articles_backup_20261012/20261005/20261001_audit, article_samenvoegingen, portal_auto_invite_claim, chat_rate_limit, herinnering_afmeld_tokens, review_afmeldingen, cyber_e4_testbewijs, cyber_activatie_config, e4_testtokens, scherm_bezoekers. Betekent: dicht voor app-gebruikers, alleen via serverfuncties. Geen lek.

## 4. Edge functions
- fflate@0.8.2 (esm.sh, 1x): zelfde ZIP64-lus als hierboven, opgelost in 0.8.3 (patch).
- zod@3.23.8 / zod@3 (8x): zelfde geheugenadvisory als zod 3.25.76; fix alleen in 4.x (major).
- @supabase/supabase-js oud: 2.45.0 (16x esm.sh), 2.45.4 (9x), 2.39.0 (1x); geen bekende kwetsbaarheid gevonden, wel verouderd.
- deno std 0.168.0 (4x) verouderd; geen bekende kwetsbaarheid geverifieerd.
- mammoth 1.11.0, pdf-lib 1.17.1, resend 4.0.0, satori 0.10.14, htmlparser2 10.0.0: geen bekende advisory gecontroleerd tegen een database (handmatig niet geverifieerd).

## Samenvatting
1. Geen critical; 6 high en 18 moderate in productiepakketten, vrijwel allemaal transitief (dompurify via jspdf, prosemirror/markdown-it via tiptap).
2. Snelste winst: tiptap naar 3.33 en verse lock voor dompurify/fflate/markdown-it (patch/minor); zod 4 en react-router 7 zijn major.
3. Dev-pakketten niet gescand (npm audit kon in deze leesmodus niet draaien).
4. Database: geen ERROR; 3 anon-uitvoerbare interne functies en 3 functies zonder vast search_path verdienen controle.
5. Edge functions: fflate 0.8.2 en zod 3.x kwetsbaar; diverse oude supabase-js-versies. Niets gewijzigd.
