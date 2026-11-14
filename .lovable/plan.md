# Nachtelijke beveiligingsscan 14-11 (alleen rapport, niets gewijzigd)

Deze "plan"-kaart bevat uitsluitend het rapport. Er is niets uit te voeren; goedkeuren of overslaan verandert niets.

## 1. npm audit
**Productie:** critical 0, high 1, moderate 2, low 0 (gelijk aan 13-11).
- zod 3.25.76, high, eerste veilige versie 4.6.6, major.
- react-router 6.30.6 (via react-router-dom), 2x moderate, veilig 7.18.0, major.

**Totaal incl. dev:** critical 3, high 42, moderate 32, low 5 (82). Alleen bouw- en testgereedschap, niet in de website zelf:
- tar 6.2.1: critical + 8 high, veilig 7.5.21, major (via oude build-hulp).
- tinypool 1.1.1: 2x critical, veilig 2.1.2, major (via vitest 3).
- vitest 3.2.7 / @vitest/mocker: moderate, veilig 4.1.11, major.
- happy-dom 20.14.5: 2x high, veilig 21.0.4, major.
- vite 5.4.19 / 7.3.7 (launch-editor, esbuild): high/moderate, veilig 6.4.4+, major voor 5.x.
- rollup 4.24.0: high, veilig 4.59.0, minor.
- sharp 0.35.4: high, veilig 0.35.5, patch.
- form-data 4.0.5: high, veilig 4.0.6, patch.
- glob 10.4.5: high, veilig 10.5.0, minor; glob 7.2.3 alleen via major.
- minimatch 3.1.2 / 9.0.5: high, veilig 3.1.4 / 9.0.7, patch.
- brace-expansion 1.1.12 / 2.0.2: high, veilig 1.1.20 / 2.1.6, patch / minor.
- picomatch 2.3.1 / 4.0.3: high, veilig 2.3.2 / 4.0.4, patch.
- js-yaml 4.1.0: high, veilig 4.3.2, minor.
- flatted 3.3.1: high, veilig 3.4.2, minor.
- browserslist 4.25.1: high, veilig 4.28.7, minor.
- ws 8.19.0 / 8.22.0: high, veilig 8.21.0+, minor (8.22 vermoedelijk al buiten bereik voor een deel).
- yaml 2.6.0: moderate, veilig 2.8.3, minor.

## 2. Verouderde pakketten (direct)
patch 9, minor 42, major 37. Geen enkele patch/minor-update van een directe afhankelijkheid lost de productiekwetsbaarheden op (zod en react-router vragen een major). Bij dev lossen patch/minor-updates van de onderliggende pakketten (sharp, form-data, minimatch, picomatch, brace-expansion, rollup, js-yaml, flatted, browserslist, ws, yaml) wel high-meldingen op; tar, tinypool, vitest en happy-dom vragen een major.

## 3. Edge functions
Externe imports: supabase-js 2.45.0 en 2, deno std 0.168.0 en 0.224.0, pdf-lib 1.17.1, mammoth 1.11.0, node-html-parser 6.1.13, fflate 0.8.2, photon 0.4.0 en resvg-wasm 2.6.2 (wasm). Geen bekende high/critical voor deze versies. zod 3.x in de functions heeft hetzelfde high-advies als hierboven (niet opnieuw per bestand nagelopen).

## 4. Linter
ERROR 0, WARN 206 (194 aangemelde gebruikers kunnen SECURITY DEFINER-functie uitvoeren, 8 publiek uitvoerbaar, 3 search_path, 1 extensie in public), INFO 35 (RLS zonder policy). Precies gelijk aan 13-11.

## NIEUW t.o.v. 13-11
Productie en linter: nee. De dev-cijfers zijn vandaag voor het eerst volledig meegeteld; ze zijn niet nieuw ontstaan door een wijziging.
