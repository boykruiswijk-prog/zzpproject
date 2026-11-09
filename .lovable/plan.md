Nachtelijke beveiligingsscan 9-11-2026 (alleen rapport, geen wijzigingen, geen plan)

1. Productie-afhankelijkheden (76 pakketten): 0 critical, 1 high, 2 moderate, 0 low
- zod 3.25.76, high (geheugenuitputting bij te grote collecties), eerste veilige versie 4.6.6, major.
- react-router-dom 6.30.6 via react-router, moderate (constructor-injectie bij SSR-hydratie), veilig vanaf react-router 7.18.0, major.
- react-router-dom 6.30.6 via react-router, moderate (open redirect via backslash, omzeiling van CVE-2025-68470), veilig vanaf 7.18.0, major.

2. Nieuw sinds gisteren: geen. Dezelfde 1 high en 2 moderate als gisteren.

3. Edge functions (versies vastgezet in imports, niet in bun.lock):
- zod 3.23.8 (4 imports), 3.25.76 (2) en zwevend zod@3 (4): zelfde high-advisory als hierboven, veilig pas in 4.6.6 (major).
- fflate 0.8.2 (esm.sh, 1 import): valt onder dezelfde advisory waarvoor de frontend al op 0.8.3 staat; de ernst is voor Edge niet apart bevestigd.
- Geen critical gevonden. De overige pakketten (supabase-js, pdf-lib, resend, mammoth 1.11.0, satori en andere) hebben bij deze controle geen bevestigde high-advisory. Die zijn hier niet door de advisorydatabase gehaald, dus dat is niet volledig gecontroleerd.

4. Database-linter: 0 ERROR, 187 WARN, 32 INFO (219 in totaal), precies hetzelfde als gisteren.
- WARN: 175 SECURITY DEFINER-functies die ingelogde gebruikers kunnen aanroepen, 8 die anon kan aanroepen, 3 functies zonder vast zoekpad, 1 extensie in public.
- INFO: 32 afgeschermde tabellen zonder policy (bewust dicht).
- Geen nieuwe bevindingen en geen ERROR.

Er is niets gewijzigd, geïnstalleerd of gemigreerd. Dit bestand is alleen gebruikt om het rapport te tonen, omdat de planmodus dat vereist.
