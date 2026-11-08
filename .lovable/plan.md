# Nachtelijke updatecontrole 8-11-2026 (alleen rapport, niets gewijzigd)

Er hoeft niets gebouwd te worden. Goedkeuren of overslaan heeft geen effect.

## 1. Audit productie (bun.lock, 76 pakketten)
critical 0, high 1, moderate 2, low 0 (gelijk aan 7-11).
- zod 3.25.76, high (geheugenuitputting bij grote collecties), veilig 4.6.6: major.
- react-router-dom 6.30.6 via react-router, moderate (constructor-injectie SSR-hydratie), veilig react-router 7.18.0: major.
- react-router-dom 6.30.6 via react-router, moderate (open redirect via backslash), veilig 7.18.0: major.

## 2. Verouderd (* = framework/beveiligingsgevoelig)
Patch: @radix-ui/react-label 2.1.7 > 2.1.17; react-day-picker 8.10.1 > 8.10.2; tailwind-merge 2.6.0 > 2.6.1; postprocessing 6.39.5 > 6.39.6; jspdf-autotable 5.0.7 > 5.0.9; dev: *vite 7.3.6 > 7.3.7, vitest 3.2.4 > 3.2.7, satori 0.35.0 > 0.35.2, sharp 0.35.4 > 0.35.5, postcss 8.5.6 > 8.5.32, tailwindcss 3.4.17 > 3.4.19, drizzle-orm 0.45.2 > 0.45.4, drizzle-kit 0.31.10 > 0.31.11, @tailwindcss/typography 0.5.16 > 0.5.20, @testing-library/react 16.3.1 > 16.3.3, pglite 0.5.11 > 0.5.15, @types/react 18.3.23 > 18.3.31, happy-dom 20.14.5 > 20.14.6.

Minor: *@supabase/supabase-js 2.108.2 > 2.119.0; @tanstack/react-query 5.83.0 > 5.107.1; react-hook-form 7.61.1 > 7.91.0; alle overige @radix-ui (circa 27, bv. dialog 1.1.14 > 1.3.1, select 2.2.5 > 2.4.1); i18next 25.8.6 > 25.10.10 (major 27); react-i18next 16.5.4 > 16.6.6 (major 18); i18next-browser-languagedetector 8.2.0 > 8.3.0; input-otp 1.4.2 > 1.5.0; fuse.js 7.4.2 > 7.5.0; mammoth 1.12.3 > 1.13.0; next-themes 0.3.0 > 0.4.6; dev: *typescript 5.8.3 > 5.9.3, eslint 9.32.0 > 9.39.5, typescript-eslint 8.38.0 > 8.72.1, autoprefixer 10.4.21 > 10.6.2, lovable-tagger 1.1.13 > 1.3.5, @types/node 22.16.5 > 22.20.5, eslint-plugin-react-refresh 0.4.20 > 0.4.26.

Major: *react / *react-dom 18.3.1 > 19.3.1; *react-router-dom 6.30.6 > 7.18.5; *zod 3.25.76 > 4.6.7; *@hookform/resolvers 3.10.0 > 7.0.3; *pdfjs-dist 4.10.38 > 6.5.438; *htmlparser2 10.0.0 > 12.0.0; react-helmet-async 2.0.5 > 3.0.0; framer-motion 11.18.2 > 14.10.1; date-fns 3.6.0 > 4.4.0; lucide-react 0.462.0 > 1.70.0; sonner 1.7.4 > 2.0.8; vaul 0.9.9 > 1.1.2; react-resizable-panels 2.1.9 > 4.19.1; three 0.160.0 > 0.187.0 (+@types/three, @react-three/fiber 8 > 9, drei 9 > 10, postprocessing 2 > 3); dev: *vite 7 > 8.3.6, *typescript > 7.0.2, vitest 3 > 5.1.0, tailwindcss 3 > 4.3.5, eslint 9 > 10, jsdom 20 > 31, postgres 3 > 4, @vitejs/plugin-react-swc 3 > 4.
Niet verouderd: *@tiptap/react en @tiptap/pm 3.33.0, *dompurify 3.4.17 (vastgezet).

## 3. Edge functions
- High: zod 3.23.8 (4 imports), zod 3.25.76 (2) en zod@3 (4): zelfde zod-advisory als hierboven, veilig pas 4.6.6 (major).
- Oudere maar zonder bekende high/critical gevonden: supabase-js 2.39.0, 2.45.0, 2.45.4; pdf-lib 1.17.1; resend 4.0.0; exceljs 4.4.0; @react-email/components 0.0.22; fflate 0.8.2 (frontend staat op 0.8.3). Edge-imports zijn niet automatisch door de advisory-database gescand; dit is een handmatige vergelijking.

## 4. Database-linter: ERROR 0, WARN 187, INFO 32 (totaal 219)
- WARN: 175 SECURITY DEFINER aanroepbaar door ingelogden, 8 door anon, 3 mutable search_path, 1 extensie in public.
- INFO: 32 RLS aan zonder policy (bewust dichtgezet).
- Nieuw t.o.v. 7-11: geen ERROR; WARN 184 > 187 (+3, waarschijnlijk de functies uit migraties 0257-0260, niet per functie bevestigd).
