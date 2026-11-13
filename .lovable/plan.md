# Nachtelijke beveiligingsscan 13-11 (alleen rapport, geen acties)

1. npm audit (productie): critical 0, high 1, moderate 2, low 0
- zod 3.25.76, high (geheugenuitputting bij te grote verzamelingen). Eerste veilige versie 4.6.6: alleen major.
- react-router-dom 6.30.6 (via react-router), moderate (2x: constructor-injectie bij SSR-hydration; open redirect via backslash). Eerste veilige versie react-router 7.18.0: alleen major.

2. Verouderde pakketten: patch 11, minor 38, major 37. Geen patch- of minor-update lost een bekende kwetsbaarheid op; beide fixes zijn major.

3. Edge functions: zod 3.23.8, 3.25.76 en zod@3 vallen onder hetzelfde high-advies (fix alleen major 4.x). Verder geen bekende high/critical in gebruikte imports (supabase-js, resend 4.0.0, pdf-lib 1.17.1, exceljs 4.4.0, fflate, satori, mammoth, node-html-parser e.a.).

4. Linter: ERROR 0, WARN 206, INFO 35.
- WARN: 194 SECURITY DEFINER uitvoerbaar door ingelogde gebruikers, 8 door anon, 3 search_path, 1 extensie in public.
- Nieuw t.o.v. gisteren: +14 WARN (192 naar 206), waarschijnlijk door nieuwe functies uit migraties 0276-0285. Niet per functie vergeleken.

NIEUW t.o.v. 12-11 (critical 0, high 1 zod 3.25.76, moderate 2 react-router 6.30.6): nee (npm). Linter: wel +14 WARN.
